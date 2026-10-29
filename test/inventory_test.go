package test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

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

func setupInventoryTestRouter(t *testing.T) (*gin.Engine, *database.DB, *services.AuthService, string, string) {
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
	orderService := services.NewOrderService(orderRepo, restaurantRepo, menuRepo, tableRepo, authService, hub)
	inventoryService := services.NewInventoryService(inventoryRepo)
	orderService.SetInventoryService(inventoryService)
	tableService := services.NewTableService(tableRepo, restaurantRepo, orderRepo, authService, "http://localhost:3000", hub)
	adminService := services.NewAdminService(adminRepo)

	orderHandler := handlers.NewOrderHandler(orderService)
	tableHandler := handlers.NewTableHandler(tableService)
	adminHandler := handlers.NewAdminHandler(adminService)
	inventoryHandler := handlers.NewInventoryHandler(inventoryService)
	authHandler := handlers.NewAuthHandler(authService)

	router := gin.Default()
	v1 := router.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.POST("/login", authHandler.Login)
		}

		v1.POST("/orders", orderHandler.CreateOrder)
		v1.GET("/orders/:orderId", orderHandler.GetOrderByID)
		v1.PATCH("/orders/:orderId/status", orderHandler.UpdateOrderStatus)

		tables := v1.Group("/tables")
		tables.Use(middleware.AuthMiddleware(authService, true))
		{
			tables.GET("", tableHandler.ListTables)
			tables.POST("", tableHandler.CreateTable)
		}

		admin := v1.Group("/admin")
		admin.Use(middleware.AuthMiddleware(authService, true))
		admin.Use(middleware.RequireRole("ADMIN", "OWNER", "MANAGER"))
		{
			admin.GET("/products", adminHandler.ListProducts)
			admin.POST("/products", adminHandler.CreateProduct)
			admin.PATCH("/orders/:orderId/status", orderHandler.UpdateOrderStatus)

			inv := admin.Group("/inventory")
			{
				inv.GET("/items", inventoryHandler.ListItems)
				inv.POST("/items", inventoryHandler.CreateItem)
				inv.GET("/items/:id", inventoryHandler.GetItem)
				inv.PATCH("/items/:id", inventoryHandler.UpdateItem)

				inv.GET("/receipts", inventoryHandler.ListReceipts)
				inv.POST("/receipts", inventoryHandler.CreateReceipt)
				inv.GET("/receipts/:id", inventoryHandler.GetReceipt)
				inv.POST("/receipts/:id/confirm", inventoryHandler.ConfirmReceipt)

				inv.POST("/adjustments", inventoryHandler.ApplyAdjustment)

				inv.GET("/recipes", inventoryHandler.ListRecipes)
				inv.GET("/recipes/:menuItemId", inventoryHandler.GetRecipe)
				inv.PUT("/recipes/:menuItemId", inventoryHandler.SaveRecipe)

				inv.GET("/movements", inventoryHandler.ListMovements)
				inv.GET("/summary", inventoryHandler.GetSummary)

				inv.GET("/alerts", inventoryHandler.ListAlerts)
				inv.PATCH("/alerts/:id", inventoryHandler.ResolveAlert)
			}
		}
	}

	// Login Admin
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

	// Fetch Restaurant ID from validated claims
	claims, err := authService.ValidateToken(loginResp.Token)
	if err != nil {
		t.Fatalf("Failed to validate token: %v", err)
	}
	restaurantID := claims.RestaurantID

	return router, db, authService, loginResp.Token, restaurantID
}

// ----------------------------------------------------
// 1. INVENTORY ITEMS CRUD TEST
// ----------------------------------------------------

func TestInventoryItemsCRUD(t *testing.T) {
	router, _, _, adminToken, _ := setupInventoryTestRouter(t)

	initialQty := 25.0
	sku := fmt.Sprintf("SKU-%s", uuid.New().String()[:6])
	itemName := fmt.Sprintf("لحم بلدي فاخر %s", uuid.New().String()[:4])

	createReq := models.CreateInventoryItemRequest{
		SKU:                  sku,
		Name:                 itemName,
		NameEn:               "Premium Minced Beef",
		Description:          "مفروم بلدي طازج يومياً",
		ItemType:             models.ItemTypeRawIngredient,
		BaseUnit:             "KG",
		MinimumStockQuantity: 5.0,
		CostPerBaseUnit:      320.0,
		InitialQuantity:      &initialQty,
	}

	body, _ := json.Marshal(createReq)
	req, _ := http.NewRequest("POST", "/api/v1/admin/inventory/items", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created for item creation, got %d: %s", w.Code, w.Body.String())
	}

	var createdItem models.InventoryItem
	if err := json.Unmarshal(w.Body.Bytes(), &createdItem); err != nil {
		t.Fatalf("Failed to unmarshal created item: %v", err)
	}

	if createdItem.ID == "" || createdItem.QuantityOnHand != 25.0 {
		t.Errorf("Expected quantity on hand 25.0, got %f", createdItem.QuantityOnHand)
	}

	// GET item by ID
	req, _ = http.NewRequest("GET", fmt.Sprintf("/api/v1/admin/inventory/items/%s", createdItem.ID), nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for GET item, got %d: %s", w.Code, w.Body.String())
	}

	// Update item
	newCost := 340.0
	updateReq := models.UpdateInventoryItemRequest{
		CostPerBaseUnit: &newCost,
	}
	body, _ = json.Marshal(updateReq)
	req, _ = http.NewRequest("PATCH", fmt.Sprintf("/api/v1/admin/inventory/items/%s", createdItem.ID), bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for PATCH item, got %d: %s", w.Code, w.Body.String())
	}

	var updatedItem models.InventoryItem
	json.Unmarshal(w.Body.Bytes(), &updatedItem)
	if updatedItem.CostPerBaseUnit != 340.0 {
		t.Errorf("Expected updated cost 340.0, got %f", updatedItem.CostPerBaseUnit)
	}
}

// ----------------------------------------------------
// 2. PURCHASE RECEIPTS & IDEMPOTENT CONFIRMATION
// ----------------------------------------------------

func TestPurchaseReceiptLifecycle(t *testing.T) {
	router, _, _, adminToken, _ := setupInventoryTestRouter(t)

	// Create test ingredient
	initQty := 10.0
	itemReq := models.CreateInventoryItemRequest{
		SKU:                  fmt.Sprintf("ING-%s", uuid.New().String()[:6]),
		Name:                 fmt.Sprintf("دقيق فاخر للبيتزا %s", uuid.New().String()[:6]),
		ItemType:             models.ItemTypeRawIngredient,
		BaseUnit:             "KG",
		MinimumStockQuantity: 10.0,
		CostPerBaseUnit:      20.0,
		InitialQuantity:      &initQty,
	}
	body, _ := json.Marshal(itemReq)
	req, _ := http.NewRequest("POST", "/api/v1/admin/inventory/items", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("Failed to create test item: %d: %s", w.Code, w.Body.String())
	}
	var createdItem models.InventoryItem
	json.Unmarshal(w.Body.Bytes(), &createdItem)

	// Create Purchase Receipt Draft (e.g. 2 sacks of 25 KG each, conversion factor = 25)
	receiptRef := fmt.Sprintf("PO-%s", uuid.New().String()[:6])
	receiptReq := models.CreatePurchaseReceiptRequest{
		ReceiptReference: receiptRef,
		SupplierName:     "مطاحن ومخابز القاهرة الكبرى",
		Notes:            "توريد أسبوعي",
		Items: []models.CreatePurchaseReceiptItemRequest{
			{
				InventoryItemID:  createdItem.ID,
				PurchaseQuantity: 2.0,
				PurchaseUnit:     "SACK_25KG",
				ConversionFactor: 25.0,
				UnitCost:         550.0, // 550 per sack
			},
		},
	}
	body, _ = json.Marshal(receiptReq)
	req, _ = http.NewRequest("POST", "/api/v1/admin/inventory/receipts", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created for receipt draft, got %d: %s", w.Code, w.Body.String())
	}

	var receipt models.PurchaseReceipt
	json.Unmarshal(w.Body.Bytes(), &receipt)
	if receipt.Status != models.ReceiptStatusDraft || receipt.TotalCost != 1100.0 {
		t.Errorf("Expected draft receipt with total 1100.0, got status=%s total=%f", receipt.Status, receipt.TotalCost)
	}

	// Confirm receipt
	req, _ = http.NewRequest("POST", fmt.Sprintf("/api/v1/admin/inventory/receipts/%s/confirm", receipt.ID), nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for receipt confirm, got %d: %s", w.Code, w.Body.String())
	}

	// Verify balance increased by 50 KG (10 initial + 50 = 60 KG)
	req, _ = http.NewRequest("GET", fmt.Sprintf("/api/v1/admin/inventory/items/%s", createdItem.ID), nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var verifiedItem models.InventoryItem
	json.Unmarshal(w.Body.Bytes(), &verifiedItem)
	if verifiedItem.QuantityOnHand != 60.0 {
		t.Errorf("Expected balance 60.0 after receiving 50 KG, got %f", verifiedItem.QuantityOnHand)
	}

	// Verify idempotency: confirming again should not fail and not add stock twice
	req, _ = http.NewRequest("POST", fmt.Sprintf("/api/v1/admin/inventory/receipts/%s/confirm", receipt.ID), nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for idempotent confirm, got %d: %s", w.Code, w.Body.String())
	}

	req, _ = http.NewRequest("GET", fmt.Sprintf("/api/v1/admin/inventory/items/%s", createdItem.ID), nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	json.Unmarshal(w.Body.Bytes(), &verifiedItem)
	if verifiedItem.QuantityOnHand != 60.0 {
		t.Errorf("Balance should remain 60.0 on idempotent retry, got %f", verifiedItem.QuantityOnHand)
	}
}

// ----------------------------------------------------
// 3. INVENTORY ADJUSTMENTS & PHYSICAL STOCK COUNT
// ----------------------------------------------------

func TestInventoryAdjustments(t *testing.T) {
	router, _, _, adminToken, _ := setupInventoryTestRouter(t)

	initQty := 50.0
	itemReq := models.CreateInventoryItemRequest{
		SKU:                  fmt.Sprintf("ADJ-%s", uuid.New().String()[:6]),
		Name:                 fmt.Sprintf("جبنة موزاريلا إيطالي %s", uuid.New().String()[:6]),
		ItemType:             models.ItemTypeRawIngredient,
		BaseUnit:             "KG",
		MinimumStockQuantity: 15.0,
		CostPerBaseUnit:      150.0,
		InitialQuantity:      &initQty,
	}
	body, _ := json.Marshal(itemReq)
	req, _ := http.NewRequest("POST", "/api/v1/admin/inventory/items", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var item models.InventoryItem
	json.Unmarshal(w.Body.Bytes(), &item)

	// 1. Waste adjustment (e.g. 5 KG damaged/spoiled)
	adjReq := models.InventoryAdjustmentRequest{
		InventoryItemID: item.ID,
		AdjustmentType:  "WASTE",
		QuantityDelta:   5.0,
		Reason:          "تلف بالتبريد",
	}
	body, _ = json.Marshal(adjReq)
	req, _ = http.NewRequest("POST", "/api/v1/admin/inventory/adjustments", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for waste adjustment, got %d: %s", w.Code, w.Body.String())
	}

	// 2. Physical stock count reconciliation (Physical count found 42 KG)
	countReq := models.InventoryAdjustmentRequest{
		InventoryItemID: item.ID,
		AdjustmentType:  "PHYSICAL_STOCK_COUNT",
		CountedQuantity: 42.0,
		Reason:          "جرد شهري فعلي",
	}
	body, _ = json.Marshal(countReq)
	req, _ = http.NewRequest("POST", "/api/v1/admin/inventory/adjustments", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for physical stock count, got %d: %s", w.Code, w.Body.String())
	}

	// Check verified balance is 42 KG
	req, _ = http.NewRequest("GET", fmt.Sprintf("/api/v1/admin/inventory/items/%s", item.ID), nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var verifiedItem models.InventoryItem
	json.Unmarshal(w.Body.Bytes(), &verifiedItem)
	if verifiedItem.QuantityOnHand != 42.0 {
		t.Errorf("Expected balance to be exactly 42.0 after physical count, got %f", verifiedItem.QuantityOnHand)
	}
}

// ----------------------------------------------------
// 4. RECIPES & AUTOMATIC CONSUMPTION ON "PREPARING"
// ----------------------------------------------------

func TestOrderPreparingAutomaticInventoryDeduction(t *testing.T) {
	router, db, _, adminToken, restaurantID := setupInventoryTestRouter(t)

	// 1. Create Bun & Patty inventory items
	bunQty := 20.0
	bunReq := models.CreateInventoryItemRequest{
		SKU:                  fmt.Sprintf("BUN-%s", uuid.New().String()[:6]),
		Name:                 fmt.Sprintf("خبز برجر سمسم %s", uuid.New().String()[:6]),
		ItemType:             models.ItemTypeRawIngredient,
		BaseUnit:             "PCS",
		MinimumStockQuantity: 10.0,
		CostPerBaseUnit:      5.0,
		InitialQuantity:      &bunQty,
	}
	body, _ := json.Marshal(bunReq)
	req, _ := http.NewRequest("POST", "/api/v1/admin/inventory/items", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("Failed to create bun item: %s", w.Body.String())
	}
	var bun models.InventoryItem
	json.Unmarshal(w.Body.Bytes(), &bun)

	pattyQty := 10.0
	pattyReq := models.CreateInventoryItemRequest{
		SKU:                  fmt.Sprintf("PAT-%s", uuid.New().String()[:6]),
		Name:                 fmt.Sprintf("برجر لحم بقري 150جم %s", uuid.New().String()[:6]),
		ItemType:             models.ItemTypeRawIngredient,
		BaseUnit:             "PCS",
		MinimumStockQuantity: 5.0,
		CostPerBaseUnit:      45.0,
		InitialQuantity:      &pattyQty,
	}
	body, _ = json.Marshal(pattyReq)
	req, _ = http.NewRequest("POST", "/api/v1/admin/inventory/items", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("Failed to create patty item: %s", w.Body.String())
	}
	var patty models.InventoryItem
	json.Unmarshal(w.Body.Bytes(), &patty)

	// 2. Create a dedicated test product without options
	isAvail := true
	prodReq := models.CreateProductRequest{
		CategoryID:  "grills",
		NameAr:      "برجر تيست " + uuid.New().String()[:4],
		Price:       120.0,
		IsAvailable: &isAvail,
	}
	body, _ = json.Marshal(prodReq)
	req, _ = http.NewRequest("POST", "/api/v1/admin/products", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("Failed to create test product: %s", w.Body.String())
	}
	var createdProduct models.Product
	json.Unmarshal(w.Body.Bytes(), &createdProduct)
	productID := createdProduct.ID

	// 3. Configure recipe: 1 Bun + 1 Patty per burger
	recipeReq := models.SaveRecipeRequest{
		Instructions: "شواء البرجر على درجة حرارة 200 وتحميص الخبز",
		Ingredients: []models.CreateRecipeIngredientRequest{
			{
				InventoryItemID:  bun.ID,
				QuantityRequired: 1.0,
				Unit:             "PCS",
			},
			{
				InventoryItemID:  patty.ID,
				QuantityRequired: 1.0,
				Unit:             "PCS",
			},
		},
	}
	body, _ = json.Marshal(recipeReq)
	req, _ = http.NewRequest("PUT", fmt.Sprintf("/api/v1/admin/inventory/recipes/%s", productID), bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK saving recipe, got %d: %s", w.Code, w.Body.String())
	}

	// 4. Create an order with 2 burgers from an active table
	var tableToken string
	_ = db.QueryRow("SELECT qr_token FROM restaurant_tables WHERE id = 'table-04'").Scan(&tableToken)
	if tableToken == "" {
		tableToken = "demo-table-token"
	}

	createOrderReq := models.CreateOrderRequest{
		RestaurantID: restaurantID,
		TableID:      "table-04",
		TableToken:   tableToken,
		Items: []models.CreateOrderItemRequest{
			{
				ProductID: productID,
				Quantity:  2,
			},
		},
	}
	body, _ = json.Marshal(createOrderReq)
	req, _ = http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("Failed to create order, got %d: %s", w.Code, w.Body.String())
	}
	var order models.Order
	json.Unmarshal(w.Body.Bytes(), &order)

	// 5. Confirm order first (NEW -> CONFIRMED)
	confirmReq := models.UpdateStatusRequest{
		Status: models.StatusConfirmed,
		Actor:  "الكابتن أحمد",
		Note:   "تم تأكيد الطلب",
	}
	body, _ = json.Marshal(confirmReq)
	req, _ = http.NewRequest("PATCH", fmt.Sprintf("/api/v1/admin/orders/%s/status", order.ID), bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK confirming order, got %d: %s", w.Code, w.Body.String())
	}

	// 6. Transition order to PREPARING
	statusReq := models.UpdateStatusRequest{
		Status: models.StatusPreparing,
		Actor:  "الشيف علاء",
		Note:   "بدء تجهيز الطلب في المطبخ",
	}
	body, _ = json.Marshal(statusReq)
	req, _ = http.NewRequest("PATCH", fmt.Sprintf("/api/v1/admin/orders/%s/status", order.ID), bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK updating order status to PREPARING, got %d: %s", w.Code, w.Body.String())
	}

	// 6. Verify inventory deducted (2 Buns deducted: 20 - 2 = 18; 2 Patties deducted: 10 - 2 = 8)
	req, _ = http.NewRequest("GET", fmt.Sprintf("/api/v1/admin/inventory/items/%s", bun.ID), nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var updatedBun models.InventoryItem
	json.Unmarshal(w.Body.Bytes(), &updatedBun)
	if updatedBun.QuantityOnHand != 18.0 {
		t.Errorf("Expected bun balance 18.0, got %f", updatedBun.QuantityOnHand)
	}

	req, _ = http.NewRequest("GET", fmt.Sprintf("/api/v1/admin/inventory/items/%s", patty.ID), nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var updatedPatty models.InventoryItem
	json.Unmarshal(w.Body.Bytes(), &updatedPatty)
	if updatedPatty.QuantityOnHand != 8.0 {
		t.Errorf("Expected patty balance 8.0, got %f", updatedPatty.QuantityOnHand)
	}

	// 7. Verify Idempotency: duplicate call to PREPARING should not deduct twice
	body, _ = json.Marshal(statusReq)
	req, _ = http.NewRequest("PATCH", fmt.Sprintf("/api/v1/admin/orders/%s/status", order.ID), bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	// It's already PREPARING, state machine may reject or accept, check balance remains 18
	req, _ = http.NewRequest("GET", fmt.Sprintf("/api/v1/admin/inventory/items/%s", bun.ID), nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	json.Unmarshal(w.Body.Bytes(), &updatedBun)
	if updatedBun.QuantityOnHand != 18.0 {
		t.Errorf("Balance should remain 18.0 on duplicate deduction attempt, got %f", updatedBun.QuantityOnHand)
	}
}

// ----------------------------------------------------
// 5. LOW-STOCK SHORTAGE & OVERRIDE POLICY TEST
// ----------------------------------------------------

func TestLowStockShortageAndOverridePolicy(t *testing.T) {
	router, db, _, adminToken, restaurantID := setupInventoryTestRouter(t)

	// Create item with only 1 unit remaining
	lowQty := 1.0
	itemReq := models.CreateInventoryItemRequest{
		SKU:                  fmt.Sprintf("LOW-%s", uuid.New().String()[:6]),
		Name:                 fmt.Sprintf("صلصة خاصة نادرة %s", uuid.New().String()[:6]),
		ItemType:             models.ItemTypeRawIngredient,
		BaseUnit:             "PCS",
		MinimumStockQuantity: 5.0,
		CostPerBaseUnit:      50.0,
		InitialQuantity:      &lowQty,
	}
	body, _ := json.Marshal(itemReq)
	req, _ := http.NewRequest("POST", "/api/v1/admin/inventory/items", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("Failed to create sauce item: %s", w.Body.String())
	}
	var sauce models.InventoryItem
	json.Unmarshal(w.Body.Bytes(), &sauce)

	// Create a dedicated test product without options
	isAvail := true
	prodReq := models.CreateProductRequest{
		CategoryID:  "grills",
		NameAr:      "طبق صوص تجريبي " + uuid.New().String()[:4],
		Price:       75.0,
		IsAvailable: &isAvail,
	}
	body, _ = json.Marshal(prodReq)
	req, _ = http.NewRequest("POST", "/api/v1/admin/products", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("Failed to create test product: %s", w.Body.String())
	}
	var createdProduct models.Product
	json.Unmarshal(w.Body.Bytes(), &createdProduct)
	productID := createdProduct.ID

	// Configure recipe requiring 3 units of sauce
	recipeReq := models.SaveRecipeRequest{
		Instructions: "صلصة وفيرة",
		Ingredients: []models.CreateRecipeIngredientRequest{
			{
				InventoryItemID:  sauce.ID,
				QuantityRequired: 3.0,
				Unit:             "PCS",
			},
		},
	}
	body, _ = json.Marshal(recipeReq)
	req, _ = http.NewRequest("PUT", fmt.Sprintf("/api/v1/admin/inventory/recipes/%s", productID), bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Create order requiring 3 units
	var tableToken string
	_ = db.QueryRow("SELECT qr_token FROM restaurant_tables WHERE id = 'table-04'").Scan(&tableToken)
	if tableToken == "" {
		tableToken = "demo-table-token"
	}

	createOrderReq := models.CreateOrderRequest{
		RestaurantID: restaurantID,
		TableID:      "table-04",
		TableToken:   tableToken,
		Items: []models.CreateOrderItemRequest{
			{
				ProductID: productID,
				Quantity:  1,
			},
		},
	}
	body, _ = json.Marshal(createOrderReq)
	req, _ = http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var order models.Order
	json.Unmarshal(w.Body.Bytes(), &order)

	// Confirm order first (NEW -> CONFIRMED)
	confirmReq := models.UpdateStatusRequest{
		Status: models.StatusConfirmed,
		Actor:  "الكابتن أحمد",
		Note:   "تم تأكيد الطلب",
	}
	body, _ = json.Marshal(confirmReq)
	req, _ = http.NewRequest("PATCH", fmt.Sprintf("/api/v1/admin/orders/%s/status", order.ID), bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK confirming order, got %d: %s", w.Code, w.Body.String())
	}

	// Attempt PREPARING WITHOUT override -> Should fail with 409 Conflict
	statusReq := models.UpdateStatusRequest{
		Status:                models.StatusPreparing,
		AllowLowStockOverride: false,
	}
	body, _ = json.Marshal(statusReq)
	req, _ = http.NewRequest("PATCH", fmt.Sprintf("/api/v1/admin/orders/%s/status", order.ID), bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("Expected 409 Conflict for shortage without override, got %d: %s", w.Code, w.Body.String())
	}

	// Verify response body has shortages details
	var conflictResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &conflictResp)
	if _, hasShortages := conflictResp["shortages"]; !hasShortages {
		t.Errorf("Expected structured 'shortages' in 409 response, got: %s", w.Body.String())
	}

	// Attempt PREPARING WITH override by Admin -> Should SUCCEED
	overrideReq := models.UpdateStatusRequest{
		Status:                models.StatusPreparing,
		AllowLowStockOverride: true,
		OverrideReason:        "تجاوز استثنائي لعميل VIP",
	}
	body, _ = json.Marshal(overrideReq)
	req, _ = http.NewRequest("PATCH", fmt.Sprintf("/api/v1/admin/orders/%s/status", order.ID), bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK with authorized low stock override, got %d: %s", w.Code, w.Body.String())
	}

	// Verify balance is now negative (-2.0 PCS)
	req, _ = http.NewRequest("GET", fmt.Sprintf("/api/v1/admin/inventory/items/%s", sauce.ID), nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var updatedSauce models.InventoryItem
	json.Unmarshal(w.Body.Bytes(), &updatedSauce)
	if updatedSauce.QuantityOnHand != -2.0 {
		t.Errorf("Expected negative stock -2.0, got %f", updatedSauce.QuantityOnHand)
	}
}

// ----------------------------------------------------
// 6. INVENTORY SUMMARY & ALERTS TEST
// ----------------------------------------------------

func TestInventorySummaryAndAlerts(t *testing.T) {
	router, _, _, adminToken, _ := setupInventoryTestRouter(t)

	// Summary
	req, _ := http.NewRequest("GET", "/api/v1/admin/inventory/summary", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for inventory summary, got %d: %s", w.Code, w.Body.String())
	}

	var summary models.InventorySummaryResponse
	json.Unmarshal(w.Body.Bytes(), &summary)
	if summary.TotalItems < 1 {
		t.Errorf("Expected at least 1 item in summary, got %d", summary.TotalItems)
	}

	// Alerts
	req, _ = http.NewRequest("GET", "/api/v1/admin/inventory/alerts", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for inventory alerts, got %d: %s", w.Code, w.Body.String())
	}

	var alertsResp models.PaginatedAlertsResponse
	json.Unmarshal(w.Body.Bytes(), &alertsResp)
	if alertsResp.Total > 0 {
		// Resolve the first alert
		firstAlert := alertsResp.Alerts[0]
		patchReq, _ := http.NewRequest("PATCH", fmt.Sprintf("/api/v1/admin/inventory/alerts/%s", firstAlert.ID), nil)
		patchReq.Header.Set("Authorization", "Bearer "+adminToken)
		pw := httptest.NewRecorder()
		router.ServeHTTP(pw, patchReq)

		if pw.Code != http.StatusOK {
			t.Errorf("Expected 200 OK resolving alert, got %d: %s", pw.Code, pw.Body.String())
		}
	}
}
