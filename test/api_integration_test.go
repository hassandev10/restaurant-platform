package test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"smart-restaurant-api/internal/config"
	"smart-restaurant-api/internal/database"
	"smart-restaurant-api/internal/handlers"
	"smart-restaurant-api/internal/middleware"
	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/realtime"
	"smart-restaurant-api/internal/repositories"
	"smart-restaurant-api/internal/services"
)

func setupTestRouter(t *testing.T) *gin.Engine {
	gin.SetMode(gin.TestMode)
	cfg := config.LoadConfig()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		t.Fatalf("Failed to connect to DB for testing: %v", err)
	}

	hub := realtime.NewHub()
	go hub.Run()

	restaurantRepo := repositories.NewRestaurantRepository(db)
	menuRepo := repositories.NewMenuRepository(db)
	orderRepo := repositories.NewOrderRepository(db)
	authRepo := repositories.NewAuthRepository(db)
	tableRepo := repositories.NewTableRepository(db)

	authService := services.NewAuthService(authRepo, cfg)
	orderService := services.NewOrderService(orderRepo, restaurantRepo, menuRepo, tableRepo, authService, hub)
	tableService := services.NewTableService(tableRepo, restaurantRepo, orderRepo, authService, "http://localhost:3000", hub)

	healthHandler := handlers.NewHealthHandler(db)
	restaurantHandler := handlers.NewRestaurantHandler(restaurantRepo, menuRepo)
	orderHandler := handlers.NewOrderHandler(orderService)
	dashboardHandler := handlers.NewDashboardHandler(orderService)
	authHandler := handlers.NewAuthHandler(authService)
	tableHandler := handlers.NewTableHandler(tableService)

	router := gin.New()
	router.Use(middleware.CORSMiddleware(cfg))

	router.GET("/health", healthHandler.HealthCheck)

	v1 := router.Group("/api/v1")
	{
		v1.GET("/restaurants/:restaurantSlug", restaurantHandler.GetRestaurantBySlug)
		v1.GET("/restaurants/:restaurantSlug/tables/:tableToken", restaurantHandler.GetTableByToken)
		v1.GET("/restaurants/:restaurantSlug/menu", restaurantHandler.GetMenu)
		v1.GET("/restaurants/:restaurantSlug/categories", restaurantHandler.GetCategories)
		v1.GET("/restaurants/:restaurantSlug/products", restaurantHandler.GetProducts)
		v1.GET("/products/:productId", restaurantHandler.GetProductByID)

		v1.POST("/orders", orderHandler.CreateOrder)
		v1.GET("/orders/:orderId", orderHandler.GetOrderByID)
		v1.GET("/orders/:orderId/events", orderHandler.GetOrderEvents)
		v1.PATCH("/orders/:orderId/status", orderHandler.UpdateOrderStatus)
		v1.POST("/orders/:orderId/cancel", orderHandler.CancelOrder)

		dashboard := v1.Group("/dashboard")
		{
			dashboard.GET("/orders", dashboardHandler.GetActiveOrders)
			dashboard.GET("/orders/active", dashboardHandler.GetActiveOrders)
			dashboard.GET("/orders/history", dashboardHandler.GetHistoricalOrders)
			dashboard.GET("/orders/:orderId", orderHandler.GetOrderByID)
			dashboard.PATCH("/orders/:orderId/status", orderHandler.UpdateOrderStatus)
			dashboard.POST("/orders/:orderId/cancel", orderHandler.CancelOrder)
			dashboard.POST("/orders/simulate", dashboardHandler.SimulateIncomingOrder)
		}

		auth := v1.Group("/auth")
		{
			auth.POST("/login", authHandler.Login)
			auth.GET("/me", middleware.AuthMiddleware(authService, true), authHandler.GetMe)
		}

		v1.POST("/public/restaurants/:restaurantSlug/table-validation", tableHandler.ValidateTableNumber)
		v1.POST("/restaurants/:restaurantSlug/table-validation", tableHandler.ValidateTableNumber)
		v1.GET("/public/qr/:token", tableHandler.ResolvePublicQR)
		v1.GET("/qr/:token", tableHandler.ResolvePublicQR)

		tables := v1.Group("/tables")
		tables.Use(middleware.AuthMiddleware(authService, true))
		{
			tables.GET("", tableHandler.ListTables)
			tables.POST("", tableHandler.CreateTable)
			tables.GET("/:tableId", tableHandler.GetTableDetails)
			tables.PATCH("/:tableId", tableHandler.UpdateTable)
			tables.GET("/:tableId/active-order", tableHandler.GetActiveOrder)
			tables.POST("/:tableId/sessions", tableHandler.OpenSession)
			tables.POST("/:tableId/sessions/:sessionId/close", tableHandler.CloseSession)
			tables.GET("/:tableId/qr", tableHandler.GetTableQR)
			tables.POST("/:tableId/qr/regenerate", tableHandler.RegenerateTableQR)
		}

		sections := v1.Group("/sections")
		sections.Use(middleware.AuthMiddleware(authService, true))
		{
			sections.GET("", tableHandler.ListSections)
			sections.POST("", tableHandler.CreateSection)
		}
	}

	return router
}

func TestHealthCheckAPI(t *testing.T) {
	router := setupTestRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	var res map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &res)
	if res["status"] != "healthy" || res["database"] != "connected" {
		t.Fatalf("Unexpected health response: %v", res)
	}
}

func TestRestaurantAndTableLookupAPI(t *testing.T) {
	router := setupTestRouter(t)

	// 1. Restaurant lookup
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/restaurants/demo-restaurant", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200 for restaurant lookup, got %d", w.Code)
	}

	var rest models.Restaurant
	json.Unmarshal(w.Body.Bytes(), &rest)
	if rest.ID != "rest-01" || rest.Slug != "demo-restaurant" {
		t.Fatalf("Unexpected restaurant: %+v", rest)
	}

	// 2. Table lookup by token
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/v1/restaurants/demo-restaurant/tables/demo-table-token", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200 for table lookup, got %d", w.Code)
	}

	var table models.RestaurantTable
	json.Unmarshal(w.Body.Bytes(), &table)
	if table.ID != "table-04" || table.Name != "طاولة 4" {
		t.Fatalf("Unexpected table: %+v", table)
	}

	// 3. Invalid table token returns 404
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/v1/restaurants/demo-restaurant/tables/invalid-token-xyz", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("Expected 404 for invalid table token, got %d", w.Code)
	}
}

func TestServerSideOrderCalculationAndTamperingPrevention(t *testing.T) {
	router := setupTestRouter(t)

	// Clean up any pending sessions on demo table-04 to ensure clean test isolation
	cfg := config.LoadConfig()
	if db, err := database.Connect(cfg.DatabaseURL); err == nil {
		_, _ = db.Exec("UPDATE table_sessions SET status = 'CLOSED', closed_at = NOW() WHERE table_id = 'table-04' AND status = 'OPEN'")
		_, _ = db.Exec("UPDATE dining_tables SET status = 'AVAILABLE' WHERE id = 'table-04'")
		db.Close()
	}

	// Customer submits an order with product 'prod-01' (base 195) + option 'size-kilo' (delta +180) + 'extra-rice' (delta +40)
	// Real price: (195 + 180 + 40) = 415 * 2 = 830 EGP
	orderPayload := models.CreateOrderRequest{
		RestaurantID: "rest-01",
		TableID:      "table-04",
		TableToken:   "demo-table-token",
		Items: []models.CreateOrderItemRequest{
			{
				ProductID: "prod-01",
				Quantity:  2,
				SelectedOptions: []models.CreateOrderItemOptionRequest{
					{GroupID: "opt-size-grill", OptionID: "size-kilo"},
					{GroupID: "opt-addons-grill", OptionID: "extra-rice"},
				},
				Notes: "بدون بصل لو سمحت",
			},
		},
	}

	body, _ := json.Marshal(orderPayload)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created for valid order, got %d. Body: %s", w.Code, w.Body.String())
	}

	var created models.Order
	json.Unmarshal(w.Body.Bytes(), &created)

	if created.Total != 830.0 {
		t.Fatalf("Server price recalculation failed! Expected total 830.00 EGP, got %.2f", created.Total)
	}

	if created.Status != models.StatusNew {
		t.Fatalf("Expected initial status NEW, got %s", created.Status)
	}

	if created.PaymentStatus != models.PaymentPending {
		t.Fatalf("Expected initial payment status PENDING_CASHIER, got %s", created.PaymentStatus)
	}

	// Step-by-step state machine transition test:
	// NEW -> CONFIRMED -> PREPARING -> READY -> SERVED
	transitions := []struct {
		targetStatus models.OrderStatus
		actor        string
	}{
		{models.StatusConfirmed, "الكابتن أحمد"},
		{models.StatusPreparing, "الشيف محمود"},
		{models.StatusReady, "الشيف محمود"},
		{models.StatusServed, "الكابتن أحمد"},
	}

	for _, step := range transitions {
		statusPayload := models.UpdateStatusRequest{
			Status: step.targetStatus,
			Actor:  step.actor,
			Note:   "تحديث تجريبي آلي",
		}
		statusBody, _ := json.Marshal(statusPayload)
		w = httptest.NewRecorder()
		req, _ = http.NewRequest("PATCH", "/api/v1/orders/"+created.ID+"/status", bytes.NewBuffer(statusBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Failed transition to %s: got status %d. Body: %s", step.targetStatus, w.Code, w.Body.String())
		}
	}

	// Verify final state is SERVED and paymentStatus is PAID
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/v1/orders/"+created.ID, nil)
	router.ServeHTTP(w, req)

	var finalOrder models.Order
	json.Unmarshal(w.Body.Bytes(), &finalOrder)
	if finalOrder.Status != models.StatusServed {
		t.Fatalf("Expected final status SERVED, got %s", finalOrder.Status)
	}
	if finalOrder.PaymentStatus != models.PaymentPaid {
		t.Fatalf("Expected paymentStatus to be auto-marked PAID upon SERVED, got %s", finalOrder.PaymentStatus)
	}
}

func TestValidationRejectsMissingRequiredOptions(t *testing.T) {
	router := setupTestRouter(t)

	// 'prod-01' has required group 'opt-size-grill' (الحجم والوزن). Submitting without it must be rejected!
	badPayload := models.CreateOrderRequest{
		RestaurantID: "rest-01",
		TableID:      "table-04",
		TableToken:   "demo-table-token",
		Items: []models.CreateOrderItemRequest{
			{
				ProductID:       "prod-01",
				Quantity:        1,
				SelectedOptions: []models.CreateOrderItemOptionRequest{}, // Missing required size option!
			},
		},
	}

	body, _ := json.Marshal(badPayload)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("Expected 422 Unprocessable Entity for missing required option, got %d", w.Code)
	}
}

func TestValidationRejectsUnavailableProducts(t *testing.T) {
	router := setupTestRouter(t)

	cfg := config.LoadConfig()
	db, _ := database.Connect(cfg.DatabaseURL)
	if db != nil {
		_, _ = db.Exec("UPDATE menu_products SET is_available = false WHERE id = 'prod-03'")
	}

	// 'prod-03' is unavailable in database (is_available = false)
	payload := models.CreateOrderRequest{
		RestaurantID: "rest-01",
		TableID:      "table-04",
		TableToken:   "demo-table-token",
		Items: []models.CreateOrderItemRequest{
			{
				ProductID: "prod-03", // Unavailable
				Quantity:  1,
			},
		},
	}

	body, _ := json.Marshal(payload)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("Expected 422 for unavailable product, got %d", w.Code)
	}
}
