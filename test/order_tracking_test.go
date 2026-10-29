package test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"smart-restaurant-api/internal/config"
	"smart-restaurant-api/internal/database"
	"smart-restaurant-api/internal/handlers"
	"smart-restaurant-api/internal/middleware"
	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/realtime"
	"smart-restaurant-api/internal/repositories"
	"smart-restaurant-api/internal/services"
)

func setupOrderTrackingTestRouter(t *testing.T) (*gin.Engine, *database.DB, *services.AuthService, string) {
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
	adminService := services.NewAdminService(adminRepo)

	orderHandler := handlers.NewOrderHandler(orderService)
	adminHandler := handlers.NewAdminHandler(adminService)
	authHandler := handlers.NewAuthHandler(authService)

	router := gin.Default()
	v1 := router.Group("/api/v1")
	{
		// Public orders routes
		v1.POST("/orders", orderHandler.CreateOrder)
		v1.GET("/orders/:orderId", orderHandler.GetOrderByID)

		// Auth
		auth := v1.Group("/auth")
		{
			auth.POST("/login", authHandler.Login)
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
		}
	}

	// Login as admin for rest-01
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

	return router, db, authService, loginResp.Token
}

func TestServerSideOrderPagination(t *testing.T) {
	router, db, _, adminToken := setupOrderTrackingTestRouter(t)

	// Seed multiple test orders to ensure reliable pagination test dataset
	now := time.Now()
	for i := 1; i <= 15; i++ {
		orderID := fmt.Sprintf("test-pag-ord-%03d-%s", i, uuid.New().String()[:6])
		orderNum := fmt.Sprintf("ORD-PAG-%03d", i)
		tableNum := fmt.Sprintf("Table %d", (i%5)+1)
		status := models.StatusNew
		if i%3 == 0 {
			status = models.StatusPreparing
		} else if i%3 == 1 {
			status = models.StatusServed
		}
		total := float64(i * 10)

		_, err := db.Exec(`
			INSERT INTO orders (id, order_number, restaurant_id, branch_id, table_id, table_name, status, subtotal, total, payment_status, created_at, updated_at)
			VALUES ($1, $2, 'rest-01', 'branch-01', 'table-02', $3, $4, $5, $5, 'UNPAID', $6, $6)
			ON CONFLICT (id) DO NOTHING
		`, orderID, orderNum, tableNum, status, total, now.Add(time.Duration(i)*time.Minute))
		if err != nil {
			t.Fatalf("Failed to seed test order: %v", err)
		}
	}

	// 1. Default pagination parameters (page=1, pageSize=12)
	t.Run("DefaultPagination", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/orders", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}

		var resp models.PaginatedOrdersResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if resp.Pagination.Page != 1 {
			t.Errorf("Expected default page 1, got %d", resp.Pagination.Page)
		}
		if resp.Pagination.PageSize != 12 {
			t.Errorf("Expected default pageSize 12, got %d", resp.Pagination.PageSize)
		}
		if resp.Pagination.TotalItems < 15 {
			t.Errorf("Expected totalItems >= 15, got %d", resp.Pagination.TotalItems)
		}
		if resp.Pagination.TotalPages < 2 {
			t.Errorf("Expected totalPages >= 2, got %d", resp.Pagination.TotalPages)
		}
		if !resp.Pagination.HasNextPage {
			t.Errorf("Expected hasNextPage to be true on page 1 with >12 items")
		}
		if resp.Pagination.HasPreviousPage {
			t.Errorf("Expected hasPreviousPage to be false on page 1")
		}
		// Check backward compatibility
		if len(resp.Data) != len(resp.Orders) || resp.Total != resp.Pagination.TotalItems {
			t.Errorf("Backward compatibility fields do not match new data/pagination fields")
		}
	})

	// 2. Second page navigation (hasNextPage and hasPreviousPage)
	t.Run("SecondPageNavigation", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/orders?page=2&pageSize=5", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}

		var resp models.PaginatedOrdersResponse
		json.Unmarshal(w.Body.Bytes(), &resp)

		if resp.Pagination.Page != 2 || resp.Pagination.PageSize != 5 {
			t.Errorf("Expected page 2, pageSize 5; got page %d, pageSize %d", resp.Pagination.Page, resp.Pagination.PageSize)
		}
		if !resp.Pagination.HasPreviousPage {
			t.Errorf("Expected hasPreviousPage to be true on page 2")
		}
		if len(resp.Data) != 5 {
			t.Errorf("Expected 5 orders on page 2, got %d", len(resp.Data))
		}
	})

	// 3. Sorting by total ascending and descending
	t.Run("SortingByTotalAscAndDesc", func(t *testing.T) {
		reqAsc, _ := http.NewRequest("GET", "/api/v1/admin/orders?page=1&pageSize=5&sort=total&order=asc", nil)
		reqAsc.Header.Set("Authorization", "Bearer "+adminToken)
		wAsc := httptest.NewRecorder()
		router.ServeHTTP(wAsc, reqAsc)

		var respAsc models.PaginatedOrdersResponse
		json.Unmarshal(wAsc.Body.Bytes(), &respAsc)

		if len(respAsc.Data) >= 2 && respAsc.Data[0].Total > respAsc.Data[1].Total {
			t.Errorf("Expected ascending order by total, but %f > %f", respAsc.Data[0].Total, respAsc.Data[1].Total)
		}

		reqDesc, _ := http.NewRequest("GET", "/api/v1/admin/orders?page=1&pageSize=5&sort=total&order=desc", nil)
		reqDesc.Header.Set("Authorization", "Bearer "+adminToken)
		wDesc := httptest.NewRecorder()
		router.ServeHTTP(wDesc, reqDesc)

		var respDesc models.PaginatedOrdersResponse
		json.Unmarshal(wDesc.Body.Bytes(), &respDesc)

		if len(respDesc.Data) >= 2 && respDesc.Data[0].Total < respDesc.Data[1].Total {
			t.Errorf("Expected descending order by total, but %f < %f", respDesc.Data[0].Total, respDesc.Data[1].Total)
		}
	})

	// 4. Filtering by status
	t.Run("FilterByStatus", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/orders?status=PREPARING", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		var resp models.PaginatedOrdersResponse
		json.Unmarshal(w.Body.Bytes(), &resp)

		for _, o := range resp.Data {
			if o.Status != models.StatusPreparing {
				t.Errorf("Expected status PREPARING, got %s for order %s", o.Status, o.ID)
			}
		}
	})

	// 5. Searching by order number
	t.Run("SearchByOrderNumber", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/orders?search=ORD-PAG-007", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		var resp models.PaginatedOrdersResponse
		json.Unmarshal(w.Body.Bytes(), &resp)

		if resp.Pagination.TotalItems < 1 {
			t.Errorf("Expected search to find ORD-PAG-007, got %d items", resp.Pagination.TotalItems)
		}
	})

	// 6. PageSize bounds (capping to 100, min 1)
	t.Run("PageSizeBoundsValidation", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/orders?page=-5&pageSize=500", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		var resp models.PaginatedOrdersResponse
		json.Unmarshal(w.Body.Bytes(), &resp)

		if resp.Pagination.Page != 1 {
			t.Errorf("Expected negative page to normalize to 1, got %d", resp.Pagination.Page)
		}
		if resp.Pagination.PageSize != 100 {
			t.Errorf("Expected pageSize > 100 to cap at 100, got %d", resp.Pagination.PageSize)
		}
	})

	// 7. Empty result handling
	t.Run("EmptySearchResults", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/orders?search=NON_EXISTENT_ORDER_XYZ_999", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		var resp models.PaginatedOrdersResponse
		json.Unmarshal(w.Body.Bytes(), &resp)

		if resp.Pagination.TotalItems != 0 {
			t.Errorf("Expected 0 total items, got %d", resp.Pagination.TotalItems)
		}
		if resp.Pagination.TotalPages != 0 {
			t.Errorf("Expected 0 total pages for empty result, got %d", resp.Pagination.TotalPages)
		}
		if resp.Pagination.HasNextPage || resp.Pagination.HasPreviousPage {
			t.Errorf("Expected no next or previous page on empty results")
		}
		if len(resp.Data) != 0 {
			t.Errorf("Expected empty Data slice, got len %d", len(resp.Data))
		}
	})
}

func TestOrderTrackingDetailsAndSecurity(t *testing.T) {
	router, db, _, adminToken := setupOrderTrackingTestRouter(t)

	// Create a comprehensive order with items, options, notes, events, cancellation
	trackingOrderID := "test-trk-ord-" + uuid.New().String()[:8]
	trackingOrderNum := "ORD-TRK-777"
	orderItemID := "test-trk-item-" + uuid.New().String()[:8]
	now := time.Now().UTC()

	// Insert order
	_, err := db.Exec(`
		INSERT INTO orders (id, order_number, restaurant_id, branch_id, table_id, table_name, status, subtotal, total, payment_status, created_at, updated_at)
		VALUES ($1, $2, 'rest-01', 'branch-01', 'table-02', 'طاولة VIP 1', 'CANCELLED', 120.00, 100.00, 'UNPAID', $3, $3)
	`, trackingOrderID, trackingOrderNum, now.Add(-30*time.Minute))
	if err != nil {
		t.Fatalf("Failed to create tracking test order: %v", err)
	}

	// Insert order item
	_, err = db.Exec(`
		INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, line_total)
		VALUES ($1, $2, 'prod-01', 'برجر كلاسيك ديلوكس', 50.00, 2, 'بدون بصل مع زيادة صوص', 120.00)
	`, orderItemID, trackingOrderID)
	if err != nil {
		t.Fatalf("Failed to insert tracking order item: %v", err)
	}

	// Insert item options snapshot
	_, err = db.Exec(`
		INSERT INTO order_item_options (id, order_item_id, group_id, group_name_ar_snapshot, option_id, option_name_ar_snapshot, price_delta_snapshot)
		VALUES 
			($1, $2, 'grp-cheese', 'إضافة الجبن', 'opt-cheddar', 'جبنة شيدر إضافية', 10.00),
			($3, $2, 'grp-size', 'الحجم', 'opt-large', 'حجم كبير', 10.00)
	`, uuid.New().String(), orderItemID, uuid.New().String())
	if err != nil {
		t.Fatalf("Failed to insert item options: %v", err)
	}

	// Insert chronological audit events
	ev1Time := now.Add(-25 * time.Minute).Format(time.RFC3339)
	ev2Time := now.Add(-15 * time.Minute).Format(time.RFC3339)
	ev3Time := now.Add(-5 * time.Minute).Format(time.RFC3339)

	_, err = db.Exec(`
		INSERT INTO order_status_events (id, order_id, status, actor, note, timestamp)
		VALUES 
			($1, $2, 'NEW', 'العميل', 'تم إنشاء الطلب من الطاولة', $3),
			($4, $2, 'PREPARING', 'الشيف أحمد', 'بدء تجهيز الطلب في المطبخ', $5),
			($6, $2, 'CANCELLED', 'مدير الصالة سامي', 'سبب الإلغاء: تم الإلغاء بناء على رغبة العميل لتأخر التجهيز', $7)
	`, uuid.New().String(), trackingOrderID, ev1Time,
		uuid.New().String(), ev2Time,
		uuid.New().String(), ev3Time)
	if err != nil {
		t.Fatalf("Failed to insert order audit events: %v", err)
	}

	// 1. Authenticated Staff Order Tracking Details via GET /api/v1/admin/orders/:orderId
	t.Run("GetOrderTrackingDetailsAdmin", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/orders/"+trackingOrderID, nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}

		var order models.Order
		if err := json.Unmarshal(w.Body.Bytes(), &order); err != nil {
			t.Fatalf("Failed to parse order: %v", err)
		}

		if order.ID != trackingOrderID || order.OrderNumber != trackingOrderNum {
			t.Errorf("Order ID or number mismatch: got %s / %s", order.ID, order.OrderNumber)
		}
		if order.RestaurantID != "rest-01" {
			t.Errorf("Expected restaurantId rest-01, got %s", order.RestaurantID)
		}
		if order.TableName != "طاولة VIP 1" {
			t.Errorf("Expected table name 'طاولة VIP 1', got %s", order.TableName)
		}

		// Verify financial fields
		if order.Subtotal != 120.00 {
			t.Errorf("Expected subtotal 120.00, got %f", order.Subtotal)
		}
		if order.Total != 100.00 {
			t.Errorf("Expected total 100.00, got %f", order.Total)
		}
		if order.Discount != 20.00 {
			t.Errorf("Expected discount 20.00, got %f", order.Discount)
		}

		// Verify item details and options snapshots
		if len(order.Items) != 1 {
			t.Fatalf("Expected 1 item, got %d", len(order.Items))
		}
		item := order.Items[0]
		if item.ProductNameSnapshot != "برجر كلاسيك ديلوكس" {
			t.Errorf("Expected item snapshot 'برجر كلاسيك ديلوكس', got %s", item.ProductNameSnapshot)
		}
		if item.Notes != "بدون بصل مع زيادة صوص" {
			t.Errorf("Expected item notes 'بدون بصل مع زيادة صوص', got %s", item.Notes)
		}
		if len(item.SelectedOptions) != 2 {
			t.Fatalf("Expected 2 selected options, got %d", len(item.SelectedOptions))
		}
		if item.SelectedOptions[0].OptionNameAr != "جبنة شيدر إضافية" && item.SelectedOptions[1].OptionNameAr != "جبنة شيدر إضافية" {
			t.Errorf("Expected 'جبنة شيدر إضافية' in options")
		}

		// Verify audit events and timeline
		if len(order.Events) != 3 {
			t.Fatalf("Expected 3 timeline events, got %d", len(order.Events))
		}
		if order.Events[0].Status != models.StatusNew || order.Events[1].Status != models.StatusPreparing || order.Events[2].Status != models.StatusCancelled {
			t.Errorf("Events order incorrect: %+v", order.Events)
		}
		if order.LatestActor != "مدير الصالة سامي" {
			t.Errorf("Expected latestActor 'مدير الصالة سامي', got '%s'", order.LatestActor)
		}

		// Verify cancellation details
		if order.CancellationReason == nil || *order.CancellationReason != "تم الإلغاء بناء على رغبة العميل لتأخر التجهيز" {
			t.Errorf("Expected cancellation reason parsed, got %v", order.CancellationReason)
		}
		if order.CancelledBy == nil || *order.CancelledBy != "مدير الصالة سامي" {
			t.Errorf("Expected cancelledBy 'مدير الصالة سامي', got %v", order.CancelledBy)
		}
		if order.CancelledAt == nil {
			t.Errorf("Expected non-nil cancelledAt")
		}
	})

	// 2. Cross-Restaurant Staff Access Isolation (403 Forbidden)
	t.Run("CrossRestaurantTenantIsolation403", func(t *testing.T) {
		// Generate staff token for another restaurant (rest-99)
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
		otherToken, err := token.SignedString([]byte(cfg.JWTSecret))
		if err != nil {
			t.Fatalf("Failed to generate token: %v", err)
		}

		req, _ := http.NewRequest("GET", "/api/v1/admin/orders/"+trackingOrderID, nil)
		req.Header.Set("Authorization", "Bearer "+otherToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusForbidden {
			t.Fatalf("Expected 403 Forbidden for cross-tenant order access, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 3. Public Customer Order Tracking (no staff token required)
	t.Run("PublicCustomerOrderTracking", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/orders/"+trackingOrderID, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for public customer tracking, got %d: %s", w.Code, w.Body.String())
		}

		var pubOrder models.Order
		json.Unmarshal(w.Body.Bytes(), &pubOrder)
		if pubOrder.ID != trackingOrderID {
			t.Errorf("Expected order ID %s, got %s", trackingOrderID, pubOrder.ID)
		}
	})
}
