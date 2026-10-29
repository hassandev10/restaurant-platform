package test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
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

func setupAdminTestRouter(t *testing.T) (*gin.Engine, *database.DB, *services.AuthService, string) {
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

	healthHandler := handlers.NewHealthHandler(db)
	restaurantHandler := handlers.NewRestaurantHandler(restaurantRepo, menuRepo)
	orderHandler := handlers.NewOrderHandler(orderService)
	dashboardHandler := handlers.NewDashboardHandler(orderService)
	authHandler := handlers.NewAuthHandler(authService)
	tableHandler := handlers.NewTableHandler(tableService)
	adminHandler := handlers.NewAdminHandler(adminService)

	router := gin.Default()
	v1 := router.Group("/api/v1")
	{
		// Restaurant & Menu routes
		v1.GET("/restaurants/:restaurantSlug", restaurantHandler.GetRestaurantBySlug)
		v1.GET("/restaurants/:restaurantSlug/menu", restaurantHandler.GetMenu)
		v1.GET("/restaurants/:restaurantSlug/categories", restaurantHandler.GetCategories)
		v1.GET("/restaurants/:restaurantSlug/products", restaurantHandler.GetProducts)
		v1.GET("/products/:productId", restaurantHandler.GetProductByID)

		// Orders routes
		v1.POST("/orders", orderHandler.CreateOrder)
		v1.GET("/orders/:orderId", orderHandler.GetOrderByID)
		v1.PATCH("/orders/:orderId/status", orderHandler.UpdateOrderStatus)
		v1.POST("/orders/:orderId/cancel", orderHandler.CancelOrder)

		// Dashboard routes
		dashboard := v1.Group("/dashboard")
		{
			dashboard.GET("/orders", dashboardHandler.GetActiveOrders)
			dashboard.GET("/orders/active", dashboardHandler.GetActiveOrders)
			dashboard.GET("/orders/history", dashboardHandler.GetHistoricalOrders)
			dashboard.POST("/orders/simulate", dashboardHandler.SimulateIncomingOrder)
		}

		// Auth routes
		auth := v1.Group("/auth")
		{
			auth.POST("/login", authHandler.Login)
			auth.GET("/me", middleware.AuthMiddleware(authService, true), authHandler.GetMe)
			auth.POST("/logout", middleware.AuthMiddleware(authService, true), authHandler.Logout)
		}

		// Table routes (Staff)
		tables := v1.Group("/tables")
		tables.Use(middleware.AuthMiddleware(authService, true))
		{
			tables.GET("", tableHandler.ListTables)
			tables.POST("", tableHandler.CreateTable)
			tables.GET("/:tableId", tableHandler.GetTableDetails)
			tables.PATCH("/:tableId", tableHandler.UpdateTable)
			tables.PATCH("/:tableId/toggle-active", tableHandler.ToggleTableActive)
			tables.DELETE("/:tableId", tableHandler.DeleteTable)
		}

		// Admin API routes (Protected: requires valid login + ADMIN/OWNER/MANAGER role)
		admin := v1.Group("/admin")
		admin.Use(middleware.AuthMiddleware(authService, true))
		admin.Use(middleware.RequireRole("ADMIN", "OWNER", "MANAGER"))
		{
			admin.GET("/dashboard/stats", adminHandler.GetDashboardStats)
			admin.GET("/analytics", adminHandler.GetAnalytics)
			admin.GET("/restaurant", adminHandler.GetRestaurantSettings)
			admin.PATCH("/restaurant", adminHandler.UpdateRestaurantSettings)

			admin.GET("/categories", adminHandler.ListCategories)
			admin.POST("/categories", adminHandler.CreateCategory)
			admin.GET("/categories/:id", adminHandler.GetCategory)
			admin.PATCH("/categories/:id", adminHandler.UpdateCategory)
			admin.DELETE("/categories/:id", adminHandler.DeleteCategory)
			admin.PATCH("/categories/reorder", adminHandler.ReorderCategories)

			admin.GET("/products", adminHandler.ListProducts)
			admin.POST("/products", adminHandler.CreateProduct)
			admin.GET("/products/:id", adminHandler.GetProduct)
			admin.PATCH("/products/:id", adminHandler.UpdateProduct)
			admin.DELETE("/products/:id", adminHandler.DeleteProduct)
			admin.PATCH("/products/:id/availability", adminHandler.ToggleProductAvailability)

			admin.GET("/tables", tableHandler.ListTables)
			admin.POST("/tables", tableHandler.CreateTable)
			admin.GET("/tables/:tableId", tableHandler.GetTableDetails)
			admin.PATCH("/tables/:tableId", tableHandler.UpdateTable)
			admin.PATCH("/tables/:tableId/toggle-active", tableHandler.ToggleTableActive)
			admin.DELETE("/tables/:tableId", tableHandler.DeleteTable)
			admin.GET("/tables/:tableId/qr", tableHandler.GetTableQR)
			admin.POST("/tables/:tableId/qr/regenerate", tableHandler.RegenerateTableQR)

			admin.GET("/orders", adminHandler.ListOrders)
			admin.GET("/orders/:orderId", orderHandler.GetOrderByID)
			admin.PATCH("/orders/:orderId/status", orderHandler.UpdateOrderStatus)
			admin.POST("/orders/:orderId/cancel", orderHandler.CancelOrder)

			admin.GET("/promotions", adminHandler.ListPromotions)
			admin.POST("/promotions", adminHandler.CreatePromotion)
			admin.GET("/promotions/:id", adminHandler.GetPromotion)
			admin.PATCH("/promotions/:id", adminHandler.UpdatePromotion)
			admin.DELETE("/promotions/:id", adminHandler.DeletePromotion)
		}
	}
	_ = healthHandler

	// Obtain Admin JWT token
	loginReq := models.LoginRequest{Username: "admin", Password: "password123"}
	loginBody, _ := json.Marshal(loginReq)
	req, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Failed to login as admin: %s", w.Body.String())
	}
	var loginResp models.LoginResponse
	json.Unmarshal(w.Body.Bytes(), &loginResp)

	return router, db, authService, loginResp.Token
}

func TestAdminAuthenticationAndAuthorization(t *testing.T) {
	router, _, _, adminToken := setupAdminTestRouter(t)

	// 1. Unauthenticated request to /api/v1/admin/dashboard/stats should be 401
	t.Run("UnauthenticatedGets401", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/dashboard/stats", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401 Unauthorized, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 2. Staff user with KITCHEN role attempting admin endpoint should be 403 Forbidden
	t.Run("KitchenRoleGets403Forbidden", func(t *testing.T) {
		loginReq := models.LoginRequest{Username: "kitchen", Password: "password123"}
		loginBody, _ := json.Marshal(loginReq)
		req, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginBody))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Kitchen login failed: %s", w.Body.String())
		}
		var kitchenLogin models.LoginResponse
		json.Unmarshal(w.Body.Bytes(), &kitchenLogin)

		adminReq, _ := http.NewRequest("GET", "/api/v1/admin/dashboard/stats", nil)
		adminReq.Header.Set("Authorization", "Bearer "+kitchenLogin.Token)
		wAdmin := httptest.NewRecorder()
		router.ServeHTTP(wAdmin, adminReq)
		if wAdmin.Code != http.StatusForbidden {
			t.Errorf("Expected 403 Forbidden for kitchen user, got %d: %s", wAdmin.Code, wAdmin.Body.String())
		}
	})

	// 3. Admin token can successfully access me and logout
	t.Run("AdminMeAndLogout", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/auth/me", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for /auth/me, got %d", w.Code)
		}

		logoutReq, _ := http.NewRequest("POST", "/api/v1/auth/logout", nil)
		logoutReq.Header.Set("Authorization", "Bearer "+adminToken)
		wLogout := httptest.NewRecorder()
		router.ServeHTTP(wLogout, logoutReq)
		if wLogout.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for /auth/logout, got %d", wLogout.Code)
		}
	})
}

func TestAdminDashboardStatsAndAnalytics(t *testing.T) {
	router, _, _, adminToken := setupAdminTestRouter(t)

	// 1. Dashboard stats
	t.Run("GetDashboardStats", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/dashboard/stats", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}

		var resp models.DashboardStatsResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse stats JSON: %v", err)
		}

		if resp.TableOccupancy.TotalTables < 1 {
			t.Errorf("Expected totalTables >= 1, got %d", resp.TableOccupancy.TotalTables)
		}
		if resp.GeneratedAt == "" {
			t.Error("Expected non-empty generatedAt timestamp")
		}
	})

	// 2. Date-range analytics
	t.Run("GetAnalyticsWithDateRange", func(t *testing.T) {
		from := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
		to := time.Now().Format("2006-01-02")
		req, _ := http.NewRequest("GET", fmt.Sprintf("/api/v1/admin/analytics?from=%s&to=%s", from, to), nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}

		var resp models.AnalyticsResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse analytics JSON: %v", err)
		}

		if resp.From == "" || resp.To == "" {
			t.Error("Expected valid from and to timestamps in analytics")
		}
	})
}

func TestAdminRestaurantSettings(t *testing.T) {
	router, _, _, adminToken := setupAdminTestRouter(t)

	// 1. Get settings
	t.Run("GetRestaurantSettings", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/restaurant", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}

		var rest models.Restaurant
		json.Unmarshal(w.Body.Bytes(), &rest)
		if rest.ID != "rest-01" {
			t.Errorf("Expected rest-01, got %s", rest.ID)
		}
	})

	// 2. Update settings
	t.Run("UpdateRestaurantSettings", func(t *testing.T) {
		phone := "01001234567"
		address := "شارع 9 المعادي، القاهرة"
		hours := "10:00 ص - 01:00 ص"
		taxRate := 14.0
		serviceFee := 12.0
		prepMins := 30
		updateReq := models.UpdateRestaurantSettingsRequest{
			Phone:                       &phone,
			Address:                     &address,
			OpeningHours:                &hours,
			TaxRate:                     &taxRate,
			ServiceFeeRate:              &serviceFee,
			EstimatedPreparationMinutes: &prepMins,
		}
		body, _ := json.Marshal(updateReq)
		req, _ := http.NewRequest("PATCH", "/api/v1/admin/restaurant", bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK updating restaurant settings, got %d: %s", w.Code, w.Body.String())
		}

		var updated models.Restaurant
		json.Unmarshal(w.Body.Bytes(), &updated)
		if updated.Phone != phone || updated.TaxRate != taxRate || updated.EstimatedPreparationMinutes != 30 {
			t.Errorf("Updated fields do not match expected: %+v", updated)
		}
	})
}

func TestAdminCategoryManagementCRUD(t *testing.T) {
	router, _, _, adminToken := setupAdminTestRouter(t)

	var createdCatID string

	// 1. Create category
	t.Run("CreateCategory", func(t *testing.T) {
		catReq := models.CreateCategoryRequest{
			NameAr:       "قسم تجريبي للاختبار",
			NameEn:       "Test Category",
			DisplayOrder: 99,
			IconName:     "Coffee",
		}
		body, _ := json.Marshal(catReq)
		req, _ := http.NewRequest("POST", "/api/v1/admin/categories", bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
		}

		var cat models.MenuCategory
		json.Unmarshal(w.Body.Bytes(), &cat)
		if cat.ID == "" || cat.NameAr != "قسم تجريبي للاختبار" {
			t.Fatalf("Unexpected category returned: %+v", cat)
		}
		createdCatID = cat.ID
	})

	// 2. Read category
	t.Run("GetCategory", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/categories/"+createdCatID, nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 3. Update category
	t.Run("UpdateCategory", func(t *testing.T) {
		newName := "قسم تجريبي معدل"
		updateReq := models.UpdateCategoryRequest{
			NameAr: &newName,
		}
		body, _ := json.Marshal(updateReq)
		req, _ := http.NewRequest("PATCH", "/api/v1/admin/categories/"+createdCatID, bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}
		var updated models.MenuCategory
		json.Unmarshal(w.Body.Bytes(), &updated)
		if updated.NameAr != newName {
			t.Errorf("Expected name %s, got %s", newName, updated.NameAr)
		}
	})

	// 4. Reorder categories
	t.Run("ReorderCategories", func(t *testing.T) {
		reorderReq := models.ReorderCategoriesRequest{
			Items: []models.ReorderCategoryItem{
				{ID: createdCatID, DisplayOrder: 50},
			},
		}
		body, _ := json.Marshal(reorderReq)
		req, _ := http.NewRequest("PATCH", "/api/v1/admin/categories/reorder", bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 5. Delete category without products should succeed
	t.Run("DeleteCategoryWithoutProducts", func(t *testing.T) {
		req, _ := http.NewRequest("DELETE", "/api/v1/admin/categories/"+createdCatID, nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK deleting empty category, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 6. Delete category with existing products must be rejected with 409 Conflict
	t.Run("RejectDeleteCategoryWithProducts", func(t *testing.T) {
		// Category 'grills' has products
		req, _ := http.NewRequest("DELETE", "/api/v1/admin/categories/grills", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusConflict {
			t.Fatalf("Expected 409 Conflict deleting category with products, got %d: %s", w.Code, w.Body.String())
		}
	})
}

func TestAdminProductManagementCRUD(t *testing.T) {
	router, testDB, _, adminToken := setupAdminTestRouter(t)

	var createdProdID string

	// 1. Create Product with Option Groups and Options in a single transaction
	t.Run("CreateProductWithOptions", func(t *testing.T) {
		isAvail := true
		optAvail := true
		prodReq := models.CreateProductRequest{
			CategoryID:  "grills",
			NameAr:      "طاجن لحم بلدي مخصوص",
			NameEn:      "Special Beef Casserole",
			Description: "طاجن بلدي مطهو على نار هادئة مع البصل والأورما",
			Price:       220.0,
			IsAvailable: &isAvail,
			Options: []models.CreateOptionGroupRequest{
				{
					NameAr:        "درجة التسوية",
					SelectionType: "SINGLE",
					IsRequired:    true,
					Options: []models.CreateOptionItemRequest{
						{NameAr: "مظبوط", PriceDelta: 0, IsAvailable: &optAvail},
						{NameAr: "دايب ومقمر", PriceDelta: 10, IsAvailable: &optAvail},
					},
				},
			},
		}
		body, _ := json.Marshal(prodReq)
		req, _ := http.NewRequest("POST", "/api/v1/admin/products", bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
		}

		var prod models.Product
		json.Unmarshal(w.Body.Bytes(), &prod)
		if prod.ID == "" || len(prod.Options) != 1 || len(prod.Options[0].Options) != 2 {
			t.Fatalf("Product options were not saved correctly: %+v", prod)
		}
		createdProdID = prod.ID
	})

	// 2. Read product
	t.Run("GetProduct", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/products/"+createdProdID, nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 3. Toggle availability
	t.Run("ToggleAvailability", func(t *testing.T) {
		toggleReq := models.ToggleAvailabilityRequest{IsAvailable: false}
		body, _ := json.Marshal(toggleReq)
		req, _ := http.NewRequest("PATCH", "/api/v1/admin/products/"+createdProdID+"/availability", bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 4. Update product
	t.Run("UpdateProduct", func(t *testing.T) {
		newPrice := 235.0
		updateReq := models.UpdateProductRequest{
			Price: &newPrice,
		}
		body, _ := json.Marshal(updateReq)
		req, _ := http.NewRequest("PATCH", "/api/v1/admin/products/"+createdProdID, bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 5. Delete product
	t.Run("DeleteProduct", func(t *testing.T) {
		req, _ := http.NewRequest("DELETE", "/api/v1/admin/products/"+createdProdID, nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK deleting product, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 6. Delete product in active order must be rejected
	t.Run("RejectDeleteProductInActiveOrder", func(t *testing.T) {
		// Ensure an active order with prod-01 exists for testing conflict
		_, err := testDB.Exec(`INSERT INTO orders (id, order_number, restaurant_id, branch_id, table_id, table_name, status, subtotal, total, payment_status)
			VALUES ('ord_test_active_prod', 'EG-TEST-01', 'rest-01', 'branch-01', 'table-04', 'طاولة 4', 'NEW', 195.00, 195.00, 'UNPAID')
			ON CONFLICT (id) DO UPDATE SET status = 'NEW'`)
		if err != nil {
			t.Fatalf("Failed to setup active order for test: %v", err)
		}
		_, err = testDB.Exec(`INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total)
			VALUES ('item_test_active_prod', 'ord_test_active_prod', 'prod-01', 'كباب وكفتة', 195.00, 1, 195.00)
			ON CONFLICT (id) DO NOTHING`)
		if err != nil {
			t.Fatalf("Failed to setup order item for test: %v", err)
		}
		defer func() {
			_, _ = testDB.Exec(`DELETE FROM order_items WHERE id = 'item_test_active_prod'`)
			_, _ = testDB.Exec(`DELETE FROM orders WHERE id = 'ord_test_active_prod'`)
		}()

		req, _ := http.NewRequest("DELETE", "/api/v1/admin/products/prod-01", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusConflict {
			t.Fatalf("Expected 409 Conflict deleting product in active order, got %d: %s", w.Code, w.Body.String())
		}
	})
}

func TestAdminOrdersPaginationAndFiltering(t *testing.T) {
	router, _, _, adminToken := setupAdminTestRouter(t)

	t.Run("ListOrdersPaginated", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/orders?page=1&pageSize=5&status=NEW", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}

		var resp models.PaginatedOrdersResponse
		json.Unmarshal(w.Body.Bytes(), &resp)
		if resp.Page != 1 || resp.PageSize != 5 {
			t.Errorf("Pagination metadata mismatch: %+v", resp)
		}
	})
}

func TestAdminPromotionsCRUD(t *testing.T) {
	router, _, _, adminToken := setupAdminTestRouter(t)

	var promoID string
	promoCode := strings.ToUpper(fmt.Sprintf("SAVE_%s", uuid.New().String()[:6]))

	// 1. Create Promotion
	t.Run("CreatePromotion", func(t *testing.T) {
		promoReq := models.CreatePromotionRequest{
			Code:          promoCode,
			Title:         "خصم ترويجي 20%",
			DiscountType:  "PERCENTAGE",
			DiscountValue: 20.0,
			MinOrderAmount: 100.0,
		}
		body, _ := json.Marshal(promoReq)
		req, _ := http.NewRequest("POST", "/api/v1/admin/promotions", bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
		}

		var promo models.Promotion
		json.Unmarshal(w.Body.Bytes(), &promo)
		if promo.ID == "" || promo.Code != promoCode {
			t.Fatalf("Unexpected promo returned: %+v", promo)
		}
		promoID = promo.ID
	})

	// 2. Reject duplicate code
	t.Run("RejectDuplicatePromoCode", func(t *testing.T) {
		promoReq := models.CreatePromotionRequest{
			Code:          promoCode,
			Title:         "كود مكرر",
			DiscountType:  "PERCENTAGE",
			DiscountValue: 10.0,
		}
		body, _ := json.Marshal(promoReq)
		req, _ := http.NewRequest("POST", "/api/v1/admin/promotions", bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("Expected 400 Bad Request for duplicate promo code, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 3. Read Promotion
	t.Run("GetPromotion", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/admin/promotions/"+promoID, nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 4. Update Promotion
	t.Run("UpdatePromotion", func(t *testing.T) {
		newVal := 25.0
		updateReq := models.UpdatePromotionRequest{
			DiscountValue: &newVal,
		}
		body, _ := json.Marshal(updateReq)
		req, _ := http.NewRequest("PATCH", "/api/v1/admin/promotions/"+promoID, bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+adminToken)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}
		var updated models.Promotion
		json.Unmarshal(w.Body.Bytes(), &updated)
		if updated.DiscountValue != 25.0 {
			t.Errorf("Expected 25.0, got %f", updated.DiscountValue)
		}
	})

	// 5. Delete Promotion
	t.Run("DeletePromotion", func(t *testing.T) {
		req, _ := http.NewRequest("DELETE", "/api/v1/admin/promotions/"+promoID, nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}
	})
}
