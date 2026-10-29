package main

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"

	"smart-restaurant-api/internal/config"
	"smart-restaurant-api/internal/database"
	"smart-restaurant-api/internal/handlers"
	"smart-restaurant-api/internal/middleware"
	"smart-restaurant-api/internal/realtime"
	"smart-restaurant-api/internal/repositories"
	"smart-restaurant-api/internal/rpc"
	"smart-restaurant-api/internal/services"
)

func main() {
	// 1. Load configuration
	cfg := config.LoadConfig()

	// 2. Connect to database
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer db.Close()

	// 3. Initialize Real-time Hub
	hub := realtime.NewHub()
	go hub.Run()

	// 4. Repositories
	restaurantRepo := repositories.NewRestaurantRepository(db)
	menuRepo := repositories.NewMenuRepository(db)
	orderRepo := repositories.NewOrderRepository(db)
	authRepo := repositories.NewAuthRepository(db)
	tableRepo := repositories.NewTableRepository(db)
	adminRepo := repositories.NewAdminRepository(db, orderRepo)
	inventoryRepo := repositories.NewInventoryRepository(db)

	// 5. Services
	customerBaseURL := "http://localhost:3000"
	authService := services.NewAuthService(authRepo, cfg)
	orderService := services.NewOrderService(orderRepo, restaurantRepo, menuRepo, tableRepo, authService, hub)
	inventoryService := services.NewInventoryService(inventoryRepo)
	orderService.SetInventoryService(inventoryService)
	tableService := services.NewTableService(tableRepo, restaurantRepo, orderRepo, authService, customerBaseURL, hub)
	adminService := services.NewAdminService(adminRepo)

	// 6. Handlers
	healthHandler := handlers.NewHealthHandler(db)
	restaurantHandler := handlers.NewRestaurantHandler(restaurantRepo, menuRepo)
	orderHandler := handlers.NewOrderHandler(orderService)
	dashboardHandler := handlers.NewDashboardHandler(orderService)
	authHandler := handlers.NewAuthHandler(authService)
	tableHandler := handlers.NewTableHandler(tableService)
	adminHandler := handlers.NewAdminHandler(adminService)
	inventoryHandler := handlers.NewInventoryHandler(inventoryService)
	wsHandler := handlers.NewWSHandler(hub)

	// 7. Router setup
	router := gin.Default()
	router.Use(middleware.CORSMiddleware(cfg))

	// ConnectRPC / Protobuf API Handlers
	rpc.RegisterRPCHandlers(router, rpc.ServerDependencies{
		AuthService:      authService,
		RestaurantRepo:   restaurantRepo,
		MenuRepo:         menuRepo,
		TableService:     tableService,
		OrderService:     orderService,
		InventoryService: inventoryService,
		AdminService:     adminService,
	})

	// Health check
	router.GET("/health", healthHandler.HealthCheck)

	// Real-time WebSocket endpoint
	router.GET("/api/v1/ws", wsHandler.HandleWS)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Restaurant & Menu routes
		v1.GET("/restaurants/:restaurantSlug", restaurantHandler.GetRestaurantBySlug)
		v1.GET("/restaurants/:restaurantSlug/tables/:tableToken", restaurantHandler.GetTableByToken)
		v1.GET("/restaurants/:restaurantSlug/menu", restaurantHandler.GetMenu)
		v1.GET("/restaurants/:restaurantSlug/categories", restaurantHandler.GetCategories)
		v1.GET("/restaurants/:restaurantSlug/products", restaurantHandler.GetProducts)
		v1.GET("/products/:productId", restaurantHandler.GetProductByID)

		// Alternative route format from README
		v1.GET("/restaurants/:restaurantSlug/orders/active", dashboardHandler.GetActiveOrders)
		v1.GET("/restaurants/:restaurantSlug/orders/history", dashboardHandler.GetHistoricalOrders)

		// Orders routes
		v1.POST("/orders", orderHandler.CreateOrder)
		v1.GET("/orders/:orderId", orderHandler.GetOrderByID)
		v1.GET("/orders/:orderId/events", orderHandler.GetOrderEvents)
		v1.PATCH("/orders/:orderId/status", orderHandler.UpdateOrderStatus)
		v1.POST("/orders/:orderId/cancel", orderHandler.CancelOrder)

		// Dashboard routes
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

		// Auth routes
		auth := v1.Group("/auth")
		{
			auth.POST("/login", authHandler.Login)
			auth.GET("/me", middleware.AuthMiddleware(authService, true), authHandler.GetMe)
			auth.POST("/logout", middleware.AuthMiddleware(authService, true), authHandler.Logout)
		}

		// Public Table Validation & QR routes (Rate-limited)
		tableValLimiter := middleware.RateLimitMiddleware(30, time.Minute)
		v1.POST("/public/restaurants/:restaurantSlug/table-validation", tableValLimiter, tableHandler.ValidateTableNumber)
		v1.POST("/restaurants/:restaurantSlug/table-validation", tableValLimiter, tableHandler.ValidateTableNumber)
		v1.GET("/public/qr/:token", tableHandler.ResolvePublicQR)
		v1.GET("/qr/:token", tableHandler.ResolvePublicQR)

		// Table Management routes (Staff only)
		tables := v1.Group("/tables")
		tables.Use(middleware.AuthMiddleware(authService, true))
		{
			tables.GET("", tableHandler.ListTables)
			tables.POST("", tableHandler.CreateTable)
			tables.GET("/:tableId", tableHandler.GetTableDetails)
			tables.PATCH("/:tableId", tableHandler.UpdateTable)
			tables.PATCH("/:tableId/toggle-active", tableHandler.ToggleTableActive)
			tables.DELETE("/:tableId", tableHandler.DeleteTable)
			tables.GET("/:tableId/active-order", tableHandler.GetActiveOrder)
			tables.GET("/:tableId/session", tableHandler.GetTableSession)
			tables.POST("/:tableId/sessions", tableHandler.OpenSession)
			tables.POST("/:tableId/sessions/:sessionId/close", tableHandler.CloseSession)
			tables.GET("/sessions/:sessionId", tableHandler.GetSessionDetails)
			tables.GET("/sessions/:sessionId/orders", tableHandler.GetSessionOrders)
			tables.POST("/sessions/:sessionId/close", tableHandler.CloseSessionDirect)
			tables.GET("/:tableId/qr", tableHandler.GetTableQR)
			tables.POST("/:tableId/qr/regenerate", tableHandler.RegenerateTableQR)
		}

		// Table Sections routes (Staff only)
		sections := v1.Group("/sections")
		sections.Use(middleware.AuthMiddleware(authService, true))
		{
			sections.GET("", tableHandler.ListSections)
			sections.POST("", tableHandler.CreateSection)
		}

		// Admin API routes (Protected: requires valid login + ADMIN/OWNER/MANAGER role)
		admin := v1.Group("/admin")
		admin.Use(middleware.AuthMiddleware(authService, true))
		admin.Use(middleware.RequireRole("ADMIN", "OWNER", "MANAGER"))
		{
			// Dashboard Stats & Analytics
			admin.GET("/dashboard/stats", adminHandler.GetDashboardStats)
			admin.GET("/analytics", adminHandler.GetAnalytics)

			// Restaurant Settings
			admin.GET("/restaurant", adminHandler.GetRestaurantSettings)
			admin.PATCH("/restaurant", adminHandler.UpdateRestaurantSettings)

			// Menu Categories
			admin.GET("/categories", adminHandler.ListCategories)
			admin.POST("/categories", adminHandler.CreateCategory)
			admin.GET("/categories/:id", adminHandler.GetCategory)
			admin.PATCH("/categories/:id", adminHandler.UpdateCategory)
			admin.DELETE("/categories/:id", adminHandler.DeleteCategory)
			admin.PATCH("/categories/reorder", adminHandler.ReorderCategories)

			// Menu Products
			admin.GET("/products", adminHandler.ListProducts)
			admin.POST("/products", adminHandler.CreateProduct)
			admin.GET("/products/:id", adminHandler.GetProduct)
			admin.PATCH("/products/:id", adminHandler.UpdateProduct)
			admin.DELETE("/products/:id", adminHandler.DeleteProduct)
			admin.PATCH("/products/:id/availability", adminHandler.ToggleProductAvailability)

			// Tables Management & Sessions (Admin)
			admin.GET("/tables", tableHandler.ListTables)
			admin.POST("/tables", tableHandler.CreateTable)
			admin.GET("/tables/:tableId", tableHandler.GetTableDetails)
			admin.PATCH("/tables/:tableId", tableHandler.UpdateTable)
			admin.PATCH("/tables/:tableId/toggle-active", tableHandler.ToggleTableActive)
			admin.DELETE("/tables/:tableId", tableHandler.DeleteTable)
			admin.GET("/tables/:tableId/qr", tableHandler.GetTableQR)
			admin.POST("/tables/:tableId/qr/regenerate", tableHandler.RegenerateTableQR)
			admin.GET("/tables/:tableId/session", tableHandler.GetTableSession)
			admin.GET("/sessions/:sessionId", tableHandler.GetSessionDetails)
			admin.GET("/sessions/:sessionId/orders", tableHandler.GetSessionOrders)
			admin.POST("/sessions/:sessionId/close", tableHandler.CloseSessionDirect)

			// Orders Management
			admin.GET("/orders", adminHandler.ListOrders)
			admin.GET("/orders/:orderId", orderHandler.GetOrderByID)
			admin.PATCH("/orders/:orderId/status", orderHandler.UpdateOrderStatus)
			admin.POST("/orders/:orderId/cancel", orderHandler.CancelOrder)

			// Promotions
			admin.GET("/promotions", adminHandler.ListPromotions)
			admin.POST("/promotions", adminHandler.CreatePromotion)
			admin.GET("/promotions/:id", adminHandler.GetPromotion)
			admin.PATCH("/promotions/:id", adminHandler.UpdatePromotion)
			admin.DELETE("/promotions/:id", adminHandler.DeletePromotion)

			// Inventory Management
			inv := admin.Group("/inventory")
			{
				// Items
				inv.GET("/items", inventoryHandler.ListItems)
				inv.POST("/items", inventoryHandler.CreateItem)
				inv.GET("/items/:id", inventoryHandler.GetItem)
				inv.PATCH("/items/:id", inventoryHandler.UpdateItem)

				// Purchase Receipts
				inv.GET("/receipts", inventoryHandler.ListReceipts)
				inv.POST("/receipts", inventoryHandler.CreateReceipt)
				inv.GET("/receipts/:id", inventoryHandler.GetReceipt)
				inv.POST("/receipts/:id/confirm", inventoryHandler.ConfirmReceipt)

				// Adjustments (Manual consumption, waste, adjustment, physical stock count)
				inv.POST("/adjustments", inventoryHandler.ApplyAdjustment)

				// Recipes
				inv.GET("/recipes", inventoryHandler.ListRecipes)
				inv.GET("/recipes/:menuItemId", inventoryHandler.GetRecipe)
				inv.PUT("/recipes/:menuItemId", inventoryHandler.SaveRecipe)

				// Movements Ledger
				inv.GET("/movements", inventoryHandler.ListMovements)

				// Summary & Valuation
				inv.GET("/summary", inventoryHandler.GetSummary)

				// Alerts
				inv.GET("/alerts", inventoryHandler.ListAlerts)
				inv.PATCH("/alerts/:id", inventoryHandler.ResolveAlert)
			}
		}
	}

	log.Printf("Starting Smart Restaurant Backend on port %s...", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
