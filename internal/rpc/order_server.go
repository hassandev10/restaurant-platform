package rpc

import (
	"context"

	"connectrpc.com/connect"

	restaurantv1 "smart-restaurant-api/gen/restaurant/v1"
	"smart-restaurant-api/gen/restaurant/v1/restaurantv1connect"
	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/repositories"
	"smart-restaurant-api/internal/services"
)

type OrderServer struct {
	orderService   *services.OrderService
	restaurantRepo *repositories.RestaurantRepository
	authService    *services.AuthService
}

func NewOrderServer(
	orderService *services.OrderService,
	restaurantRepo *repositories.RestaurantRepository,
	authService *services.AuthService,
) restaurantv1connect.OrderServiceHandler {
	return &OrderServer{
		orderService:   orderService,
		restaurantRepo: restaurantRepo,
		authService:    authService,
	}
}

func (s *OrderServer) CreateOrder(ctx context.Context, req *connect.Request[restaurantv1.CreateOrderRequest]) (*connect.Response[restaurantv1.CreateOrderResponse], error) {
	msg := req.Msg

	items := make([]models.CreateOrderItemRequest, 0, len(msg.GetItems()))
	for _, it := range msg.GetItems() {
		opts := make([]models.CreateOrderItemOptionRequest, 0, len(it.GetSelectedOptions()))
		for _, o := range it.GetSelectedOptions() {
			opts = append(opts, models.CreateOrderItemOptionRequest{
				GroupID:  o.GetGroupId(),
				OptionID: o.GetOptionId(),
			})
		}
		items = append(items, models.CreateOrderItemRequest{
			ProductID:       it.GetProductId(),
			Quantity:        int(it.GetQuantity()),
			SelectedOptions: opts,
			Notes:           it.GetNotes(),
		})
	}

	createReq := models.CreateOrderRequest{
		OrderType:         fromProtoOrderType(msg.GetOrderType()),
		TableContextToken: msg.GetTableContextToken(),
		TableToken:        msg.GetTableToken(),
		RestaurantID:      msg.GetRestaurantId(),
		BranchID:          msg.GetBranchId(),
		TableID:           msg.GetTableId(),
		TableNameSnapshot: msg.GetTableNameSnapshot(),
		TableName:         msg.GetTableName(),
		Items:             items,
		Notes:             msg.GetNotes(),
		ForceNewOrder:     msg.GetForceNewOrder(),
	}

	order, err := s.orderService.CreateOrder(createReq)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	return connect.NewResponse(&restaurantv1.CreateOrderResponse{
		Order: toProtoOrder(order),
	}), nil
}

func (s *OrderServer) GetOrder(ctx context.Context, req *connect.Request[restaurantv1.GetOrderRequest]) (*connect.Response[restaurantv1.GetOrderResponse], error) {
	order, err := s.orderService.GetOrderByID(req.Msg.GetOrderId())
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	return connect.NewResponse(&restaurantv1.GetOrderResponse{
		Order: toProtoOrder(order),
	}), nil
}

func (s *OrderServer) GetOrderEvents(ctx context.Context, req *connect.Request[restaurantv1.GetOrderEventsRequest]) (*connect.Response[restaurantv1.GetOrderEventsResponse], error) {
	events, err := s.orderService.GetOrderEvents(req.Msg.GetOrderId())
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	protoEvents := make([]*restaurantv1.OrderEvent, 0, len(events))
	for _, ev := range events {
		protoEvents = append(protoEvents, &restaurantv1.OrderEvent{
			Id:        ev.ID,
			Timestamp: ev.Timestamp,
			Status:    parseOrderStatus(string(ev.Status)),
			Actor:     ev.Actor,
			Note:      ev.Note,
		})
	}

	return connect.NewResponse(&restaurantv1.GetOrderEventsResponse{
		Events: protoEvents,
	}), nil
}

func (s *OrderServer) UpdateOrderStatus(ctx context.Context, req *connect.Request[restaurantv1.UpdateOrderStatusRequest]) (*connect.Response[restaurantv1.UpdateOrderStatusResponse], error) {
	claims, _ := extractStaffClaims(ctx, req.Header(), s.authService, false)
	actor := req.Msg.GetActor()
	var actorID, actorRole string
	if claims != nil {
		actorID = claims.UserID
		actorRole = claims.Role
		if actor == "" {
			actor = claims.Name
		}
	}

	targetStatus := fromProtoOrderStatus(req.Msg.GetStatus())
	order, err := s.orderService.UpdateOrderStatusWithOptions(
		req.Msg.GetOrderId(),
		targetStatus,
		actorID,
		actor,
		actorRole,
		req.Msg.GetNote(),
		req.Msg.GetAllowLowStockOverride(),
		req.Msg.GetOverrideReason(),
	)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.UpdateOrderStatusResponse{
		Order: toProtoOrder(order),
	}), nil
}

func (s *OrderServer) CancelOrder(ctx context.Context, req *connect.Request[restaurantv1.CancelOrderRequest]) (*connect.Response[restaurantv1.CancelOrderResponse], error) {
	claims, _ := extractStaffClaims(ctx, req.Header(), s.authService, false)
	actor := req.Msg.GetActor()
	if actor == "" && claims != nil {
		actor = claims.Name
	}

	order, err := s.orderService.CancelOrder(req.Msg.GetOrderId(), req.Msg.GetReason(), actor)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.CancelOrderResponse{
		Order: toProtoOrder(order),
	}), nil
}

func (s *OrderServer) ListActiveOrders(ctx context.Context, req *connect.Request[restaurantv1.ListActiveOrdersRequest]) (*connect.Response[restaurantv1.ListActiveOrdersResponse], error) {
	var restaurantID string
	if req.Msg.GetRestaurantSlug() != "" {
		rest, err := s.restaurantRepo.GetRestaurantBySlug(req.Msg.GetRestaurantSlug())
		if err != nil {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		restaurantID = rest.ID
	} else {
		claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
		if err != nil {
			return nil, err
		}
		restaurantID = claims.RestaurantID
	}

	orders, err := s.orderService.GetActiveOrders(restaurantID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	protoOrders := make([]*restaurantv1.Order, 0, len(orders))
	for _, o := range orders {
		protoOrders = append(protoOrders, toProtoOrder(&o))
	}

	return connect.NewResponse(&restaurantv1.ListActiveOrdersResponse{
		Orders: protoOrders,
	}), nil
}

func (s *OrderServer) ListHistoricalOrders(ctx context.Context, req *connect.Request[restaurantv1.ListHistoricalOrdersRequest]) (*connect.Response[restaurantv1.ListHistoricalOrdersResponse], error) {
	var restaurantID string
	if req.Msg.GetRestaurantSlug() != "" {
		rest, err := s.restaurantRepo.GetRestaurantBySlug(req.Msg.GetRestaurantSlug())
		if err != nil {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		restaurantID = rest.ID
	} else {
		claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
		if err != nil {
			return nil, err
		}
		restaurantID = claims.RestaurantID
	}

	orders, err := s.orderService.GetHistoricalOrders(restaurantID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	protoOrders := make([]*restaurantv1.Order, 0, len(orders))
	for _, o := range orders {
		protoOrders = append(protoOrders, toProtoOrder(&o))
	}

	return connect.NewResponse(&restaurantv1.ListHistoricalOrdersResponse{
		Orders: protoOrders,
	}), nil
}

func (s *OrderServer) SimulateIncomingOrder(ctx context.Context, req *connect.Request[restaurantv1.SimulateIncomingOrderRequest]) (*connect.Response[restaurantv1.SimulateIncomingOrderResponse], error) {
	restaurantID := req.Msg.GetRestaurantId()
	if restaurantID == "" {
		claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
		if err != nil {
			return nil, err
		}
		restaurantID = claims.RestaurantID
	}

	order, err := s.orderService.SimulateIncomingOrder(restaurantID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.SimulateIncomingOrderResponse{
		Order: toProtoOrder(order),
	}), nil
}
