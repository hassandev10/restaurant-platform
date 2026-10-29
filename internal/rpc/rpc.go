package rpc

import (
	"github.com/gin-gonic/gin"

	"smart-restaurant-api/gen/restaurant/v1/restaurantv1connect"
	"smart-restaurant-api/internal/repositories"
	"smart-restaurant-api/internal/services"
)

type ServerDependencies struct {
	AuthService      *services.AuthService
	RestaurantRepo   *repositories.RestaurantRepository
	MenuRepo         *repositories.MenuRepository
	TableService     *services.TableService
	OrderService     *services.OrderService
	InventoryService *services.InventoryService
	AdminService     *services.AdminService
}

func RegisterRPCHandlers(router *gin.Engine, deps ServerDependencies) {
	// 1. Auth Service
	authServer := NewAuthServer(deps.AuthService)
	authPath, authH := restaurantv1connect.NewAuthServiceHandler(authServer)
	router.Any(authPath+"*action", gin.WrapH(authH))

	// 2. Restaurant Service
	restServer := NewRestaurantServer(deps.RestaurantRepo, deps.AdminService, deps.AuthService)
	restPath, restH := restaurantv1connect.NewRestaurantServiceHandler(restServer)
	router.Any(restPath+"*action", gin.WrapH(restH))

	// 3. Menu Service
	menuServer := NewMenuServer(deps.RestaurantRepo, deps.MenuRepo, deps.AdminService, deps.AuthService)
	menuPath, menuH := restaurantv1connect.NewMenuServiceHandler(menuServer)
	router.Any(menuPath+"*action", gin.WrapH(menuH))

	// 4. Table Service
	tableServer := NewTableServer(deps.TableService, deps.AuthService)
	tablePath, tableH := restaurantv1connect.NewTableServiceHandler(tableServer)
	router.Any(tablePath+"*action", gin.WrapH(tableH))

	// 5. Order Service
	orderServer := NewOrderServer(deps.OrderService, deps.RestaurantRepo, deps.AuthService)
	orderPath, orderH := restaurantv1connect.NewOrderServiceHandler(orderServer)
	router.Any(orderPath+"*action", gin.WrapH(orderH))

	// 6. Inventory Service
	invServer := NewInventoryServer(deps.InventoryService, deps.AuthService)
	invPath, invH := restaurantv1connect.NewInventoryServiceHandler(invServer)
	router.Any(invPath+"*action", gin.WrapH(invH))

	// 7. Admin Service
	adminServer := NewAdminServer(deps.AdminService, deps.AuthService)
	adminPath, adminH := restaurantv1connect.NewAdminServiceHandler(adminServer)
	router.Any(adminPath+"*action", gin.WrapH(adminH))
}
