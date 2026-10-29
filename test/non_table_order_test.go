package test

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
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

func setupNonTableOrderTestRouter(t *testing.T) (*gin.Engine, *database.DB, *services.OrderService, *services.AuthService, string) {
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
	inventoryRepo := repositories.NewInventoryRepository(db)

	authService := services.NewAuthService(authRepo, cfg)
	inventoryService := services.NewInventoryService(inventoryRepo)
	orderService := services.NewOrderService(orderRepo, restaurantRepo, menuRepo, tableRepo, authService, hub)
	orderService.SetInventoryService(inventoryService)
	adminService := services.NewAdminService(adminRepo)

	orderHandler := handlers.NewOrderHandler(orderService)
	dashboardHandler := handlers.NewDashboardHandler(orderService)
	adminHandler := handlers.NewAdminHandler(adminService)
	authHandler := handlers.NewAuthHandler(authService)

	router := gin.Default()
	v1 := router.Group("/api/v1")
	{
		v1.POST("/orders", orderHandler.CreateOrder)
		v1.GET("/orders/:orderId", orderHandler.GetOrderByID)

		v1.GET("/dashboard/orders/active", dashboardHandler.GetActiveOrders)
		v1.GET("/dashboard/orders/history", dashboardHandler.GetHistoricalOrders)
		v1.PATCH("/dashboard/orders/:orderId/status", orderHandler.UpdateOrderStatus)
		v1.POST("/dashboard/orders/:orderId/cancel", orderHandler.CancelOrder)

		v1.POST("/auth/login", authHandler.Login)

		admin := v1.Group("/admin")
		admin.Use(middleware.AuthMiddleware(authService, true))
		admin.Use(middleware.RequireRole("ADMIN", "OWNER", "MANAGER"))
		{
			admin.GET("/orders", adminHandler.ListOrders)
		}
	}

	// Generate admin token
	now := time.Now()
	claims := jwt.MapClaims{
		"userId":       "admin-user-01",
		"restaurantId": "rest-01",
		"email":        "admin@albasha.com",
		"role":         "ADMIN",
		"exp":          now.Add(24 * time.Hour).Unix(),
		"iat":          now.Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, _ := token.SignedString([]byte(cfg.JWTSecret))

	return router, db, orderService, authService, tokenStr
}

func TestNonTableAndTakeawayOrderFlow(t *testing.T) {
	router, db, orderService, _, adminToken := setupNonTableOrderTestRouter(t)

	var createdTakeawayOrderID string

	t.Run("CreateTakeawayOrderSuccessWithoutTableOrToken", func(t *testing.T) {
		reqBody := models.CreateOrderRequest{
			OrderType:    models.OrderTypeTakeaway,
			RestaurantID: "rest-01",
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-01",
					Quantity:  2,
					SelectedOptions: []models.CreateOrderItemOptionRequest{
						{GroupID: "opt-size-grill", OptionID: "size-half"},
						{GroupID: "opt-addons-grill", OptionID: "extra-tahina"},
					},
					Notes: "بدون شطة إضافية",
				},
			},
		}

		bodyBytes, _ := json.Marshal(reqBody)
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created for takeaway order, got %d: %s", w.Code, w.Body.String())
		}

		var resp models.Order
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if resp.OrderType != models.OrderTypeTakeaway {
			t.Errorf("Expected OrderType TAKEAWAY, got %s", resp.OrderType)
		}
		if resp.TableID != "" {
			t.Errorf("Expected empty TableID for takeaway, got '%s'", resp.TableID)
		}
		if resp.SessionID != nil {
			t.Errorf("Expected nil SessionID for takeaway, got '%v'", *resp.SessionID)
		}
		if resp.TableName != "طلب سفري" {
			t.Errorf("Expected TableName 'طلب سفري', got '%s'", resp.TableName)
		}
		if resp.PaymentStatus != models.PaymentPending {
			t.Errorf("Expected payment status PENDING_CASHIER, got %s", resp.PaymentStatus)
		}
		if resp.Status != models.StatusNew {
			t.Errorf("Expected initial status NEW, got %s", resp.Status)
		}

		createdTakeawayOrderID = resp.ID

		// Direct Database Verification: verify orders row directly
		var dbOrderType string
		var dbTableID sql.NullString
		var dbSessionID sql.NullString
		var dbTableName sql.NullString
		query := `SELECT order_type, table_id, session_id, table_name FROM orders WHERE id = $1`
		err := db.QueryRow(query, resp.ID).Scan(&dbOrderType, &dbTableID, &dbSessionID, &dbTableName)
		if err != nil {
			t.Fatalf("Failed to query order in DB: %v", err)
		}

		if dbOrderType != "TAKEAWAY" {
			t.Errorf("DB order_type expected 'TAKEAWAY', got '%s'", dbOrderType)
		}
		if dbTableID.Valid {
			t.Errorf("DB table_id expected NULL for takeaway, got '%s'", dbTableID.String)
		}
		if dbSessionID.Valid {
			t.Errorf("DB session_id expected NULL for takeaway, got '%s'", dbSessionID.String)
		}
		if !dbTableName.Valid || dbTableName.String != "طلب سفري" {
			t.Errorf("DB table_name expected 'طلب سفري', got '%v'", dbTableName)
		}
	})

	t.Run("CreateTakeawayOrderByRestaurantSlug", func(t *testing.T) {
		reqBody := models.CreateOrderRequest{
			OrderType:    models.OrderTypeTakeaway,
			RestaurantID: "demo-restaurant", // Using actual slug
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-04",
					Quantity:  1,
				},
			},
		}

		bodyBytes, _ := json.Marshal(reqBody)
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created for takeaway order by slug, got %d: %s", w.Code, w.Body.String())
		}

		var resp models.Order
		_ = json.Unmarshal(w.Body.Bytes(), &resp)
		if resp.RestaurantID != "rest-01" {
			t.Errorf("Expected resolved restaurant ID 'rest-01', got '%s'", resp.RestaurantID)
		}
		if resp.OrderType != models.OrderTypeTakeaway {
			t.Errorf("Expected OrderType TAKEAWAY, got %s", resp.OrderType)
		}
	})

	t.Run("RejectTakeawayOrderWithTableTokenOrContext", func(t *testing.T) {
		reqBody := models.CreateOrderRequest{
			OrderType:    models.OrderTypeTakeaway,
			RestaurantID: "rest-01",
			TableToken:   "token_t4",
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-02",
					Quantity:  1,
				},
			},
		}

		bodyBytes, _ := json.Marshal(reqBody)
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnprocessableEntity {
			t.Fatalf("Expected 422 Unprocessable Entity for inconsistent takeaway with table token, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("RejectDineInOrderWithoutTableContext", func(t *testing.T) {
		reqBody := models.CreateOrderRequest{
			OrderType:    models.OrderTypeDineIn,
			RestaurantID: "rest-01",
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-02",
					Quantity:  1,
				},
			},
		}

		bodyBytes, _ := json.Marshal(reqBody)
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnprocessableEntity {
			t.Fatalf("Expected 422 Unprocessable Entity for DINE_IN order without table context, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("RejectUnsupportedOrderType", func(t *testing.T) {
		reqBody := models.CreateOrderRequest{
			OrderType:    "DELIVERY",
			RestaurantID: "rest-01",
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-02",
					Quantity:  1,
				},
			},
		}

		bodyBytes, _ := json.Marshal(reqBody)
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnprocessableEntity {
			t.Fatalf("Expected 422 Unprocessable Entity for DELIVERY order type, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("TakeawayOrderVisibleInDashboardActiveOrders", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/dashboard/orders/active?restaurantId=rest-01", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK from active orders, got %d", w.Code)
		}

		var orders []models.Order
		if err := json.Unmarshal(w.Body.Bytes(), &orders); err != nil {
			t.Fatalf("Failed to parse orders: %v", err)
		}

		var found bool
		for _, o := range orders {
			if o.ID == createdTakeawayOrderID {
				found = true
				if o.OrderType != models.OrderTypeTakeaway {
					t.Errorf("Expected active order type TAKEAWAY, got %s", o.OrderType)
				}
				if o.TableID != "" {
					t.Errorf("Expected empty TableID, got %s", o.TableID)
				}
				break
			}
		}
		if !found {
			t.Errorf("Takeaway order %s not found in active orders list", createdTakeawayOrderID)
		}
	})

	t.Run("AdminListOrdersFiltersTakeawayAndDineIn", func(t *testing.T) {
		// Filter by TAKEAWAY
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/admin/orders?orderType=TAKEAWAY", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK from admin orders with TAKEAWAY filter, got %d: %s", w.Code, w.Body.String())
		}

		var listResp models.PaginatedOrdersResponse
		if err := json.Unmarshal(w.Body.Bytes(), &listResp); err != nil {
			t.Fatalf("Failed to decode admin orders list response: %v", err)
		}

		if len(listResp.Orders) == 0 {
			t.Fatalf("Expected at least 1 takeaway order in admin list, got 0")
		}

		for _, o := range listResp.Orders {
			if o.OrderType != models.OrderTypeTakeaway {
				t.Errorf("Expected only TAKEAWAY orders in filtered list, got %s (order %s)", o.OrderType, o.ID)
			}
		}

		// Filter by DINE_IN
		w2 := httptest.NewRecorder()
		req2, _ := http.NewRequest(http.MethodGet, "/api/v1/admin/orders?orderType=DINE_IN", nil)
		req2.Header.Set("Authorization", "Bearer "+adminToken)
		router.ServeHTTP(w2, req2)

		if w2.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK from admin orders with DINE_IN filter, got %d: %s", w2.Code, w2.Body.String())
		}

		var listResp2 models.PaginatedOrdersResponse
		_ = json.Unmarshal(w2.Body.Bytes(), &listResp2)
		for _, o := range listResp2.Orders {
			if o.OrderType != models.OrderTypeDineIn {
				t.Errorf("Expected only DINE_IN orders in filtered list, got %s (order %s)", o.OrderType, o.ID)
			}
		}
	})

	t.Run("TakeawayOrderLifecycleTransitionsAndStockDeduction", func(t *testing.T) {
		// 1. Transition to CONFIRMED
		confirmReq := models.UpdateStatusRequest{
			Status: models.StatusConfirmed,
			Actor:  "كابتن أحمد",
			Note:   "تم تأكيد الطلب السفري وتوجيهه للمطبخ",
		}
		confirmBytes, _ := json.Marshal(confirmReq)
		w1 := httptest.NewRecorder()
		r1, _ := http.NewRequest(http.MethodPatch, fmt.Sprintf("/api/v1/dashboard/orders/%s/status", createdTakeawayOrderID), bytes.NewBuffer(confirmBytes))
		r1.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w1, r1)
		if w1.Code != http.StatusOK {
			t.Fatalf("Failed to transition to CONFIRMED: %s", w1.Body.String())
		}

		// 2. Transition to PREPARING (Triggers stock deduction)
		prepReq := models.UpdateStatusRequest{
			Status: models.StatusPreparing,
			Actor:  "شيف حسام",
			Note:   "بدء تجهيز الوجبات السفرية",
		}
		prepBytes, _ := json.Marshal(prepReq)
		w2 := httptest.NewRecorder()
		r2, _ := http.NewRequest(http.MethodPatch, fmt.Sprintf("/api/v1/dashboard/orders/%s/status", createdTakeawayOrderID), bytes.NewBuffer(prepBytes))
		r2.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w2, r2)
		if w2.Code != http.StatusOK {
			t.Fatalf("Failed to transition to PREPARING: %s", w2.Body.String())
		}

		// 3. Transition to READY
		readyReq := models.UpdateStatusRequest{
			Status: models.StatusReady,
			Actor:  "شيف حسام",
			Note:   "الطلب جاهز للتسليم في منطقة الاستلام",
		}
		readyBytes, _ := json.Marshal(readyReq)
		w3 := httptest.NewRecorder()
		r3, _ := http.NewRequest(http.MethodPatch, fmt.Sprintf("/api/v1/dashboard/orders/%s/status", createdTakeawayOrderID), bytes.NewBuffer(readyBytes))
		r3.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w3, r3)
		if w3.Code != http.StatusOK {
			t.Fatalf("Failed to transition to READY: %s", w3.Body.String())
		}

		// 4. Transition to SERVED (Completed and paid at cashier)
		servedReq := models.UpdateStatusRequest{
			Status: models.StatusServed,
			Actor:  "كاشير محمود",
			Note:   "تم تسليم الطلب للعميل واستلام الحساب نقداً",
		}
		servedBytes, _ := json.Marshal(servedReq)
		w4 := httptest.NewRecorder()
		r4, _ := http.NewRequest(http.MethodPatch, fmt.Sprintf("/api/v1/dashboard/orders/%s/status", createdTakeawayOrderID), bytes.NewBuffer(servedBytes))
		r4.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w4, r4)
		if w4.Code != http.StatusOK {
			t.Fatalf("Failed to transition to SERVED: %s", w4.Body.String())
		}

		var servedOrder models.Order
		_ = json.Unmarshal(w4.Body.Bytes(), &servedOrder)
		if servedOrder.Status != models.StatusServed {
			t.Errorf("Expected status SERVED, got %s", servedOrder.Status)
		}
		if servedOrder.PaymentStatus != models.PaymentPaid {
			t.Errorf("Expected payment status PAID upon SERVED, got %s", servedOrder.PaymentStatus)
		}
	})

	t.Run("CancelTakeawayOrder", func(t *testing.T) {
		// Create a fresh takeaway order to cancel
		newTakeaway, err := orderService.CreateOrder(models.CreateOrderRequest{
			OrderType:    models.OrderTypeTakeaway,
			RestaurantID: "rest-01",
			Items: []models.CreateOrderItemRequest{
				{ProductID: "prod-04", Quantity: 1},
			},
		})
		if err != nil {
			t.Fatalf("Failed to create takeaway order for cancellation: %v", err)
		}

		cancelReq := models.CancelOrderRequest{
			Reason: "طلب العميل تغيير الصنف قبل البدء",
			Actor:  "كاشير محمود",
		}
		cancelBytes, _ := json.Marshal(cancelReq)
		w := httptest.NewRecorder()
		r, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/dashboard/orders/%s/cancel", newTakeaway.ID), bytes.NewBuffer(cancelBytes))
		r.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for cancel order, got %d: %s", w.Code, w.Body.String())
		}

		var cancelledOrder models.Order
		_ = json.Unmarshal(w.Body.Bytes(), &cancelledOrder)
		if cancelledOrder.Status != models.StatusCancelled {
			t.Errorf("Expected status CANCELLED, got %s", cancelledOrder.Status)
		}
		if cancelledOrder.PaymentStatus != models.PaymentCancelled {
			t.Errorf("Expected payment status CANCELLED, got %s", cancelledOrder.PaymentStatus)
		}
	})

	t.Run("DatabaseCheckConstraintPreventsInvalidState", func(t *testing.T) {
		// 1. Attempting to insert TAKEAWAY with non-null table_id must fail DB constraint
		badTakeawayQuery := `
			INSERT INTO orders (id, order_number, restaurant_id, table_id, order_type, status, subtotal, total, payment_status, created_at, updated_at)
			VALUES ($1, 'EG-BAD-01', 'rest-01', 'table-01', 'TAKEAWAY', 'NEW', 100.0, 100.0, 'PENDING_CASHIER', NOW(), NOW())
		`
		_, err := db.Exec(badTakeawayQuery, "ord_bad_takeaway")
		if err == nil {
			t.Errorf("Expected DB check constraint failure when inserting TAKEAWAY with table_id, but it succeeded")
		}

		// 2. Attempting to insert DINE_IN with NULL table_id must fail DB constraint
		badDineInQuery := `
			INSERT INTO orders (id, order_number, restaurant_id, table_id, order_type, status, subtotal, total, payment_status, created_at, updated_at)
			VALUES ($1, 'EG-BAD-02', 'rest-01', NULL, 'DINE_IN', 'NEW', 100.0, 100.0, 'PENDING_CASHIER', NOW(), NOW())
		`
		_, err = db.Exec(badDineInQuery, "ord_bad_dine_in")
		if err == nil {
			t.Errorf("Expected DB check constraint failure when inserting DINE_IN without table_id, but it succeeded")
		}
	})
}
