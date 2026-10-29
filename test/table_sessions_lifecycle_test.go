package test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"smart-restaurant-api/internal/config"
	"smart-restaurant-api/internal/database"
	"smart-restaurant-api/internal/handlers"
	"smart-restaurant-api/internal/middleware"
	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/realtime"
	"smart-restaurant-api/internal/repositories"
	"smart-restaurant-api/internal/services"
)

func setupSessionLifecycleTestRouter(t *testing.T) (*gin.Engine, *database.DB, *services.AuthService, *services.OrderService, *services.TableService, string) {
	gin.SetMode(gin.TestMode)
	cfg := config.LoadConfig()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	hub := realtime.NewHub()
	go hub.Run()

	restaurantRepo := repositories.NewRestaurantRepository(db)
	menuRepo := repositories.NewMenuRepository(db)
	orderRepo := repositories.NewOrderRepository(db)
	authRepo := repositories.NewAuthRepository(db)
	tableRepo := repositories.NewTableRepository(db)
	adminRepo := repositories.NewAdminRepository(db, orderRepo)

	authService := services.NewAuthService(authRepo, cfg)
	orderService := services.NewOrderService(orderRepo, restaurantRepo, menuRepo, tableRepo, authService, hub)
	tableService := services.NewTableService(tableRepo, restaurantRepo, orderRepo, authService, "http://localhost:3000", hub)
	adminService := services.NewAdminService(adminRepo)

	orderHandler := handlers.NewOrderHandler(orderService)
	adminHandler := handlers.NewAdminHandler(adminService)
	authHandler := handlers.NewAuthHandler(authService)
	tableHandler := handlers.NewTableHandler(tableService)

	router := gin.Default()
	v1 := router.Group("/api/v1")
	{
		// Public routes
		v1.POST("/orders", orderHandler.CreateOrder)
		v1.GET("/orders/:orderId", orderHandler.GetOrderByID)
		v1.GET("/public/qr/:token", tableHandler.ResolvePublicQR)

		// Auth
		auth := v1.Group("/auth")
		{
			auth.POST("/login", authHandler.Login)
		}

		// Table Management routes (Staff)
		tables := v1.Group("/tables")
		tables.Use(middleware.AuthMiddleware(authService, true))
		{
			tables.GET("/:tableId/session", tableHandler.GetTableSession)
			tables.GET("/sessions/:sessionId", tableHandler.GetSessionDetails)
			tables.GET("/sessions/:sessionId/orders", tableHandler.GetSessionOrders)
			tables.POST("/sessions/:sessionId/close", tableHandler.CloseSessionDirect)
		}

		// Admin API routes (Protected)
		admin := v1.Group("/admin")
		admin.Use(middleware.AuthMiddleware(authService, true))
		admin.Use(middleware.RequireRole("ADMIN", "OWNER", "MANAGER"))
		{
			admin.GET("/orders", adminHandler.ListOrders)
			admin.GET("/orders/:orderId", orderHandler.GetOrderByID)
			admin.PATCH("/orders/:orderId/status", orderHandler.UpdateOrderStatus)
			admin.POST("/orders/:orderId/cancel", orderHandler.CancelOrder)

			// Table Sessions (Admin)
			admin.GET("/tables/:tableId/session", tableHandler.GetTableSession)
			admin.GET("/sessions/:sessionId", tableHandler.GetSessionDetails)
			admin.GET("/sessions/:sessionId/orders", tableHandler.GetSessionOrders)
			admin.POST("/sessions/:sessionId/close", tableHandler.CloseSessionDirect)
		}
	}

	// Login as admin
	loginBody, _ := json.Marshal(map[string]string{
		"username": "admin",
		"password": "password123",
	})
	req, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Admin login failed: %s", w.Body.String())
	}

	var loginResp struct {
		Token string `json:"token"`
	}
	json.Unmarshal(w.Body.Bytes(), &loginResp)

	return router, db, authService, orderService, tableService, loginResp.Token
}

func TestTableSessionsAndOrderLifecycle(t *testing.T) {
	router, db, _, _, _, adminToken := setupSessionLifecycleTestRouter(t)

	// Clean up any open sessions on table-07 before test
	_, _ = db.Exec(`UPDATE table_sessions SET status = 'CLOSED', closed_at = NOW() WHERE table_id = 'table-07' AND status = 'OPEN'`)
	_, _ = db.Exec(`UPDATE dining_tables SET status = 'AVAILABLE' WHERE id = 'table-07'`)

	// 1. Repeated QR scans without order submission must NOT create a session
	t.Run("QRScanWithoutOrderDoesNotCreateSession", func(t *testing.T) {
		for i := 0; i < 3; i++ {
			req, _ := http.NewRequest("GET", "/api/v1/public/qr/tbl-07", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("Expected 200 OK for QR resolve, got %d", w.Code)
			}
		}

		// Verify no open session was created
		var openCount int
		err := db.QueryRow("SELECT COUNT(*) FROM table_sessions WHERE table_id = 'table-07' AND status = 'OPEN'").Scan(&openCount)
		if err != nil || openCount != 0 {
			t.Errorf("Expected 0 open sessions after QR scan, got %d", openCount)
		}
	})

	// 2. First order submission opens a new dining session atomically
	var sessionID string
	var firstOrderID string
	t.Run("FirstOrderOpensSessionAtomically", func(t *testing.T) {
		createReq := models.CreateOrderRequest{
			TableToken: "tbl-07",
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-04",
					Quantity:  1,
				},
			},
		}
		body, _ := json.Marshal(createReq)
		req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created for first order, got %d: %s", w.Code, w.Body.String())
		}

		var order models.Order
		json.Unmarshal(w.Body.Bytes(), &order)
		if order.SessionID == nil || *order.SessionID == "" {
			t.Fatalf("Expected order to have an active sessionID assigned")
		}
		sessionID = *order.SessionID
		firstOrderID = order.ID

		// Verify session exists and is OPEN in DB
		var sessStatus string
		err := db.QueryRow("SELECT status FROM table_sessions WHERE id = $1", sessionID).Scan(&sessStatus)
		if err != nil || sessStatus != "OPEN" {
			t.Fatalf("Expected session %s to be OPEN, got %s (err: %v)", sessionID, sessStatus, err)
		}

		// Verify table status is now OCCUPIED
		var tblStatus string
		_ = db.QueryRow("SELECT status FROM dining_tables WHERE id = 'table-07'").Scan(&tblStatus)
		if tblStatus != "OCCUPIED" {
			t.Errorf("Expected table status OCCUPIED, got %s", tblStatus)
		}
	})

	// 3. Adding items to an eligible NEW order modifies that same order
	t.Run("AddingItemsToEligibleNewOrderModifiesSameOrder", func(t *testing.T) {
		addReq := models.CreateOrderRequest{
			TableToken: "tbl-07",
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-05",
					Quantity:  2,
				},
			},
		}
		body, _ := json.Marshal(addReq)
		req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated && w.Code != http.StatusOK {
			t.Fatalf("Expected 200/201 on adding items, got %d: %s", w.Code, w.Body.String())
		}

		var updatedOrder models.Order
		json.Unmarshal(w.Body.Bytes(), &updatedOrder)

		// Must be the SAME order ID
		if updatedOrder.ID != firstOrderID {
			t.Errorf("Expected same order ID %s, but got %s", firstOrderID, updatedOrder.ID)
		}
		if *updatedOrder.SessionID != sessionID {
			t.Errorf("Expected same session ID %s, got %s", sessionID, *updatedOrder.SessionID)
		}
		// Must have 2 items now (prod-04 and prod-05)
		if len(updatedOrder.Items) != 2 {
			t.Errorf("Expected 2 items in order, got %d", len(updatedOrder.Items))
		}
		// Must have audit event for the item addition
		hasAddEvent := false
		for _, ev := range updatedOrder.Events {
			if ev.Status == models.StatusNew && strings.Contains(ev.Note, "إضافة") {
				hasAddEvent = true
				break
			}
		}
		if !hasAddEvent {
			t.Errorf("Expected audit event recording addition of items")
		}
	})

	// 4. When order moves to CONFIRMED / PREPARING, it is no longer eligible for modification
	// Subsequent customer order creates a separate order linked to the same session
	var secondOrderID string
	t.Run("AdditionalOrderAfterPreparationCreatesSeparateOrderInSameSession", func(t *testing.T) {
		// Transition first order from NEW -> CONFIRMED -> PREPARING
		for _, nextSt := range []models.OrderStatus{models.StatusConfirmed, models.StatusPreparing} {
			statusReq := models.UpdateStatusRequest{Status: nextSt}
			statusBody, _ := json.Marshal(statusReq)
			patchReq, _ := http.NewRequest("PATCH", "/api/v1/admin/orders/"+firstOrderID+"/status", bytes.NewBuffer(statusBody))
			patchReq.Header.Set("Authorization", "Bearer "+adminToken)
			patchReq.Header.Set("Content-Type", "application/json")
			wPatch := httptest.NewRecorder()
			router.ServeHTTP(wPatch, patchReq)

			if wPatch.Code != http.StatusOK {
				t.Fatalf("Failed to transition first order to %s: %s", nextSt, wPatch.Body.String())
			}
		}

		// Customer orders additional items
		extraReq := models.CreateOrderRequest{
			TableToken: "tbl-07",
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-06",
					Quantity:  1,
				},
			},
		}
		extraBody, _ := json.Marshal(extraReq)
		req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(extraBody))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created for separate order, got %d: %s", w.Code, w.Body.String())
		}

		var secondOrder models.Order
		json.Unmarshal(w.Body.Bytes(), &secondOrder)

		// Must be a SEPARATE order ID
		if secondOrder.ID == firstOrderID {
			t.Fatalf("Expected a NEW order ID, but modified existing order %s", firstOrderID)
		}
		// Must be linked to the SAME dining session
		if secondOrder.SessionID == nil || *secondOrder.SessionID != sessionID {
			t.Fatalf("Expected second order to link to session %s, got %v", sessionID, secondOrder.SessionID)
		}
		secondOrderID = secondOrder.ID
	})

	// 5. Session summary API verification (GET /api/v1/admin/sessions/:sessionId)
	t.Run("SessionSummaryAPIs", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/sessions/"+sessionID, nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for session summary, got %d: %s", w.Code, w.Body.String())
		}

		var session models.TableSession
		json.Unmarshal(w.Body.Bytes(), &session)

		if session.ID != sessionID {
			t.Errorf("Expected session ID %s, got %s", sessionID, session.ID)
		}
		if session.TableNumber != "7" {
			t.Errorf("Expected table number 7, got %s", session.TableNumber)
		}
		if session.Status != models.SessionStatusOpen {
			t.Errorf("Expected session status OPEN, got %s", session.Status)
		}
		if len(session.Orders) != 2 {
			t.Errorf("Expected 2 orders in session, got %d", len(session.Orders))
		}
		if session.Total <= 0 {
			t.Errorf("Expected positive session total, got %f", session.Total)
		}
		if session.PaymentStatus != string(models.PaymentPending) {
			t.Errorf("Expected PaymentStatus PENDING_CASHIER, got %s", session.PaymentStatus)
		}

		// Also verify GET /api/v1/admin/tables/:tableId/session
		reqTable, _ := http.NewRequest("GET", "/api/v1/admin/tables/table-07/session", nil)
		reqTable.Header.Set("Authorization", "Bearer "+adminToken)
		wTable := httptest.NewRecorder()
		router.ServeHTTP(wTable, reqTable)

		if wTable.Code != http.StatusOK {
			t.Errorf("Expected 200 OK for GET table session, got %d: %s", wTable.Code, wTable.Body.String())
		}

		// Also verify GET /api/v1/admin/sessions/:sessionId/orders
		reqOrders, _ := http.NewRequest("GET", "/api/v1/admin/sessions/"+sessionID+"/orders", nil)
		reqOrders.Header.Set("Authorization", "Bearer "+adminToken)
		wOrders := httptest.NewRecorder()
		router.ServeHTTP(wOrders, reqOrders)

		if wOrders.Code != http.StatusOK {
			t.Errorf("Expected 200 OK for GET session orders, got %d", wOrders.Code)
		}
	})

	// 6. Session closure rejects closing when active orders are still in progress
	t.Run("RejectSessionClosureWithActiveOrders", func(t *testing.T) {
		closeReq := models.CloseSessionRequest{
			Notes:    "محاولة إغلاق عادية",
			Override: false,
		}
		body, _ := json.Marshal(closeReq)
		req, _ := http.NewRequest("POST", "/api/v1/admin/sessions/"+sessionID+"/close", bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusConflict && w.Code != http.StatusBadRequest {
			t.Fatalf("Expected conflict error when closing session with active orders, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 7. Successful authorized session closure releases table and records closed_by
	t.Run("AuthorizedSessionClosureRecordsStaffAndReleasesTable", func(t *testing.T) {
		// Serve both orders through valid lifecycle transitions
		for _, nextSt := range []models.OrderStatus{models.StatusReady, models.StatusServed} {
			sReq, _ := json.Marshal(models.UpdateStatusRequest{Status: nextSt})
			pReq, _ := http.NewRequest("PATCH", "/api/v1/admin/orders/"+firstOrderID+"/status", bytes.NewBuffer(sReq))
			pReq.Header.Set("Authorization", "Bearer "+adminToken)
			pReq.Header.Set("Content-Type", "application/json")
			wPatch := httptest.NewRecorder()
			router.ServeHTTP(wPatch, pReq)
		}

		for _, nextSt := range []models.OrderStatus{models.StatusConfirmed, models.StatusPreparing, models.StatusReady, models.StatusServed} {
			sReq, _ := json.Marshal(models.UpdateStatusRequest{Status: nextSt})
			pReq, _ := http.NewRequest("PATCH", "/api/v1/admin/orders/"+secondOrderID+"/status", bytes.NewBuffer(sReq))
			pReq.Header.Set("Authorization", "Bearer "+adminToken)
			pReq.Header.Set("Content-Type", "application/json")
			wPatch := httptest.NewRecorder()
			router.ServeHTTP(wPatch, pReq)
		}

		// Close session with override / authorized close
		closeReq := models.CloseSessionRequest{
			Notes:        "تمت المحاسبة ومغادرة الضيوف",
			TargetStatus: "AVAILABLE",
			Override:     true,
		}
		body, _ := json.Marshal(closeReq)
		req, _ := http.NewRequest("POST", "/api/v1/admin/sessions/"+sessionID+"/close", bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for session closure, got %d: %s", w.Code, w.Body.String())
		}

		var closedSess models.TableSession
		json.Unmarshal(w.Body.Bytes(), &closedSess)

		if closedSess.Status != models.SessionStatusClosed {
			t.Errorf("Expected session status CLOSED, got %s", closedSess.Status)
		}
		if closedSess.ClosedAt == nil {
			t.Errorf("Expected ClosedAt timestamp to be set")
		}
		if closedSess.ClosedBy == "" {
			t.Errorf("Expected ClosedBy staff ID to be recorded")
		}

		// Table status should now be AVAILABLE
		var tblStatus string
		_ = db.QueryRow("SELECT status FROM dining_tables WHERE id = 'table-07'").Scan(&tblStatus)
		if tblStatus != "AVAILABLE" {
			t.Errorf("Expected table status AVAILABLE after release, got %s", tblStatus)
		}
	})

	// 8. Next customer order creates a brand NEW session (never attaches to closed session)
	t.Run("SubsequentOrderCreatesBrandNewSession", func(t *testing.T) {
		nextReq := models.CreateOrderRequest{
			TableToken: "tbl-07",
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-04",
					Quantity:  1,
				},
			},
		}
		body, _ := json.Marshal(nextReq)
		req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created for new session order, got %d: %s", w.Code, w.Body.String())
		}

		var thirdOrder models.Order
		json.Unmarshal(w.Body.Bytes(), &thirdOrder)

		if thirdOrder.SessionID == nil || *thirdOrder.SessionID == sessionID {
			t.Fatalf("Expected a BRAND NEW session ID, but attached to closed session %s", sessionID)
		}

		// Clean up this third session
		_ = thirdOrder
	})

	// 9. Concurrent order creation at the same table creates strictly 1 active session
	t.Run("ConcurrentFirstOrdersCreateOnlyOneOpenSession", func(t *testing.T) {
		// Clean table-12 sessions first
		_, _ = db.Exec(`UPDATE table_sessions SET status = 'CLOSED', closed_at = NOW() WHERE table_id = 'table-12' AND status = 'OPEN'`)
		_, _ = db.Exec(`UPDATE dining_tables SET status = 'AVAILABLE' WHERE id = 'table-12'`)

		concurrentOrders := 4
		var wg sync.WaitGroup
		wg.Add(concurrentOrders)

		sessionIDs := make([]string, concurrentOrders)
		statusCodes := make([]int, concurrentOrders)

		for i := 0; i < concurrentOrders; i++ {
			idx := i
			go func() {
				defer wg.Done()
				cReq := models.CreateOrderRequest{
					TableToken: "tbl-12",
					Items: []models.CreateOrderItemRequest{
						{
							ProductID: "prod-04",
							Quantity:  1,
						},
					},
				}
				cBody, _ := json.Marshal(cReq)
				r, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(cBody))
				r.Header.Set("Content-Type", "application/json")
				wRec := httptest.NewRecorder()
				router.ServeHTTP(wRec, r)

				statusCodes[idx] = wRec.Code
				if wRec.Code == http.StatusCreated || wRec.Code == http.StatusOK {
					var o models.Order
					json.Unmarshal(wRec.Body.Bytes(), &o)
					if o.SessionID != nil {
						sessionIDs[idx] = *o.SessionID
					}
				}
			}()
		}

		wg.Wait()

		// Verify database has strictly ONE open session for table-12
		var activeSessionsCount int
		err := db.QueryRow("SELECT COUNT(*) FROM table_sessions WHERE table_id = 'table-12' AND status = 'OPEN'").Scan(&activeSessionsCount)
		if err != nil || activeSessionsCount != 1 {
			t.Fatalf("Expected strictly 1 open session for table-12, got %d (err: %v)", activeSessionsCount, err)
		}
	})

	// 10. Multi-tenant Isolation: Staff from another restaurant cannot access or close session
	t.Run("CrossRestaurantSessionAccessRejection", func(t *testing.T) {
		cfg := config.LoadConfig()
		otherClaims := &services.Claims{
			UserID:       "user-other-99",
			RestaurantID: "rest-other-99",
			Role:         "ADMIN",
			Name:         "Other Restaurant Admin",
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
			},
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, otherClaims)
		otherToken, _ := token.SignedString([]byte(cfg.JWTSecret))

		req, _ := http.NewRequest("GET", "/api/v1/admin/sessions/"+sessionID, nil)
		req.Header.Set("Authorization", "Bearer "+otherToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound && w.Code != http.StatusForbidden {
			t.Errorf("Expected 404/403 for cross-restaurant session access, got %d", w.Code)
		}
	})
}
