package test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"connectrpc.com/connect"
	"github.com/gin-gonic/gin"

	restaurantv1 "smart-restaurant-api/gen/restaurant/v1"
	"smart-restaurant-api/gen/restaurant/v1/restaurantv1connect"
	"smart-restaurant-api/internal/config"
	"smart-restaurant-api/internal/database"
	"smart-restaurant-api/internal/realtime"
	"smart-restaurant-api/internal/repositories"
	"smart-restaurant-api/internal/rpc"
	"smart-restaurant-api/internal/services"
)

func setupTestRPCServer(t *testing.T) (*httptest.Server, *services.AuthService) {
	gin.SetMode(gin.TestMode)
	cfg := config.LoadConfig()
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	hub := realtime.NewHub()
	restaurantRepo := repositories.NewRestaurantRepository(db)
	menuRepo := repositories.NewMenuRepository(db)
	tableRepo := repositories.NewTableRepository(db)
	authRepo := repositories.NewAuthRepository(db)
	authService := services.NewAuthService(authRepo, cfg)
	orderRepo := repositories.NewOrderRepository(db)
	adminRepo := repositories.NewAdminRepository(db, orderRepo)
	inventoryRepo := repositories.NewInventoryRepository(db)
	inventoryService := services.NewInventoryService(inventoryRepo)
	orderService := services.NewOrderService(orderRepo, restaurantRepo, menuRepo, tableRepo, authService, hub)
	orderService.SetInventoryService(inventoryService)
	tableService := services.NewTableService(tableRepo, restaurantRepo, orderRepo, authService, "http://localhost:3000", hub)
	adminService := services.NewAdminService(adminRepo)

	router := gin.New()
	rpc.RegisterRPCHandlers(router, rpc.ServerDependencies{
		AuthService:      authService,
		RestaurantRepo:   restaurantRepo,
		MenuRepo:         menuRepo,
		TableService:     tableService,
		OrderService:     orderService,
		InventoryService: inventoryService,
		AdminService:     adminService,
	})

	server := httptest.NewServer(router)
	return server, authService
}

func TestConnectRPCAuthFlow(t *testing.T) {
	server, _ := setupTestRPCServer(t)
	defer server.Close()

	client := restaurantv1connect.NewAuthServiceClient(http.DefaultClient, server.URL)
	ctx := context.Background()

	// 1. Valid Login
	loginResp, err := client.Login(ctx, connect.NewRequest(&restaurantv1.LoginRequest{
		Username: "admin",
		Password: "password123",
	}))
	if err != nil {
		t.Fatalf("Login failed: %v", err)
	}

	token := loginResp.Msg.GetToken()
	if token == "" {
		t.Fatalf("Expected token, got empty")
	}
	if loginResp.Msg.GetUser().GetRole() != restaurantv1.StaffRole_STAFF_ROLE_ADMIN {
		t.Fatalf("Expected STAFF_ROLE_ADMIN, got %v", loginResp.Msg.GetUser().GetRole())
	}

	// 2. GetMe with Token
	getMeReq := connect.NewRequest(&restaurantv1.GetMeRequest{})
	getMeReq.Header().Set("Authorization", "Bearer "+token)
	getMeResp, err := client.GetMe(ctx, getMeReq)
	if err != nil {
		t.Fatalf("GetMe failed: %v", err)
	}
	if getMeResp.Msg.GetUser().GetUsername() != "admin" {
		t.Fatalf("Expected username admin, got %s", getMeResp.Msg.GetUser().GetUsername())
	}

	// 3. Invalid credentials
	_, err = client.Login(ctx, connect.NewRequest(&restaurantv1.LoginRequest{
		Username: "admin",
		Password: "wrongpassword",
	}))
	if err == nil {
		t.Fatalf("Expected error for wrong password, got nil")
	}
}

func TestConnectRPCRestaurantAndMenu(t *testing.T) {
	server, _ := setupTestRPCServer(t)
	defer server.Close()

	restClient := restaurantv1connect.NewRestaurantServiceClient(http.DefaultClient, server.URL)
	menuClient := restaurantv1connect.NewMenuServiceClient(http.DefaultClient, server.URL)
	ctx := context.Background()

	// 1. GetRestaurant
	restResp, err := restClient.GetRestaurant(ctx, connect.NewRequest(&restaurantv1.GetRestaurantRequest{
		Slug: "demo-restaurant",
	}))
	if err != nil {
		t.Fatalf("GetRestaurant failed: %v", err)
	}
	if restResp.Msg.GetRestaurant().GetSlug() != "demo-restaurant" {
		t.Fatalf("Expected slug demo-restaurant, got %s", restResp.Msg.GetRestaurant().GetSlug())
	}

	// 2. GetMenu
	menuResp, err := menuClient.GetMenu(ctx, connect.NewRequest(&restaurantv1.GetMenuRequest{
		RestaurantSlug: "demo-restaurant",
	}))
	if err != nil {
		t.Fatalf("GetMenu failed: %v", err)
	}
	if len(menuResp.Msg.GetCategories()) == 0 {
		t.Fatalf("Expected categories, got none")
	}
	if len(menuResp.Msg.GetProducts()) == 0 {
		t.Fatalf("Expected products, got none")
	}
}

func TestConnectRPCOrdersAndTables(t *testing.T) {
	server, _ := setupTestRPCServer(t)
	defer server.Close()

	authClient := restaurantv1connect.NewAuthServiceClient(http.DefaultClient, server.URL)
	orderClient := restaurantv1connect.NewOrderServiceClient(http.DefaultClient, server.URL)
	tableClient := restaurantv1connect.NewTableServiceClient(http.DefaultClient, server.URL)
	adminClient := restaurantv1connect.NewAdminServiceClient(http.DefaultClient, server.URL)
	ctx := context.Background()

	// Login
	loginResp, err := authClient.Login(ctx, connect.NewRequest(&restaurantv1.LoginRequest{
		Username: "admin",
		Password: "password123",
	}))
	if err != nil {
		t.Fatalf("Login failed: %v", err)
	}
	token := loginResp.Msg.GetToken()

	// List tables
	listTablesReq := connect.NewRequest(&restaurantv1.ListTablesRequest{})
	listTablesReq.Header().Set("Authorization", "Bearer "+token)
	tablesResp, err := tableClient.ListTables(ctx, listTablesReq)
	if err != nil {
		t.Fatalf("ListTables failed: %v", err)
	}
	if len(tablesResp.Msg.GetTables()) == 0 {
		t.Fatalf("Expected tables, got none")
	}
	testTable := tablesResp.Msg.GetTables()[0]
	t.Logf("Found table: ID=%s, Number=%s, Name=%s", testTable.GetId(), testTable.GetTableNumber(), testTable.GetDisplayName())

	// Validate table to obtain context token
	validateTableResp, err := tableClient.ValidateTableNumber(ctx, connect.NewRequest(&restaurantv1.ValidateTableNumberRequest{
		RestaurantSlug: "demo-restaurant",
		TableInput:     testTable.GetTableNumber(),
	}))
	if err != nil {
		t.Fatalf("ValidateTableNumber failed: %v", err)
	}
	t.Logf("ValidateTableResp: Valid=%v, ContextToken=%s, Token=%s, Error=%s",
		validateTableResp.Msg.GetValid(),
		validateTableResp.Msg.GetTableContextToken(),
		validateTableResp.Msg.GetToken(),
		validateTableResp.Msg.GetErrorMessage(),
	)

	// Create Order (Dine In)
	createOrderReq := connect.NewRequest(&restaurantv1.CreateOrderRequest{
		OrderType:         restaurantv1.OrderType_ORDER_TYPE_DINE_IN,
		TableContextToken: validateTableResp.Msg.GetTableContextToken(),
		TableToken:        validateTableResp.Msg.GetToken(),
		RestaurantId:      "rest-01",
		BranchId:          "branch-01",
		TableId:           testTable.GetId(),
		TableNameSnapshot: testTable.GetDisplayName(),
		Items: []*restaurantv1.CreateOrderItemRequest{
			{
				ProductId: "prod-04",
				Quantity:  1,
			},
		},
	})
	createOrderResp, err := orderClient.CreateOrder(ctx, createOrderReq)
	if err != nil {
		t.Fatalf("CreateOrder failed: %v", err)
	}

	orderID := createOrderResp.Msg.GetOrder().GetId()
	if orderID == "" {
		t.Fatalf("Expected order ID, got empty")
	}

	// Update Status to CONFIRMED
	updateStatusReq := connect.NewRequest(&restaurantv1.UpdateOrderStatusRequest{
		OrderId: orderID,
		Status:  restaurantv1.OrderStatus_ORDER_STATUS_CONFIRMED,
		Actor:   "الكابتن أحمد",
	})
	updateStatusReq.Header().Set("Authorization", "Bearer "+token)
	updateResp, err := orderClient.UpdateOrderStatus(ctx, updateStatusReq)
	if err != nil {
		t.Fatalf("UpdateOrderStatus failed: %v", err)
	}
	if updateResp.Msg.GetOrder().GetStatus() != restaurantv1.OrderStatus_ORDER_STATUS_CONFIRMED {
		t.Fatalf("Expected CONFIRMED, got %v", updateResp.Msg.GetOrder().GetStatus())
	}

	// Admin Dashboard Stats
	statsReq := connect.NewRequest(&restaurantv1.GetDashboardStatsRequest{})
	statsReq.Header().Set("Authorization", "Bearer "+token)
	statsResp, err := adminClient.GetDashboardStats(ctx, statsReq)
	if err != nil {
		t.Fatalf("GetDashboardStats failed: %v", err)
	}
	if statsResp.Msg.GetTableOccupancy() == nil {
		t.Fatalf("Expected table occupancy stats, got nil")
	}
}
