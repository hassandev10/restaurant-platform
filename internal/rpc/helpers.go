package rpc

import (
	"context"
	"strings"
	"time"

	"connectrpc.com/connect"

	restaurantv1 "smart-restaurant-api/gen/restaurant/v1"
	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/services"
)

func extractStaffClaims(ctx context.Context, header interface{ Get(string) string }, authService *services.AuthService, requireAuth bool) (*services.Claims, error) {
	authHeader := header.Get("Authorization")
	if authHeader == "" {
		if requireAuth {
			return nil, connect.NewError(connect.CodeUnauthenticated, connect.NewError(connect.CodeUnauthenticated, nil))
		}
		return nil, nil
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		if requireAuth {
			return nil, connect.NewError(connect.CodeUnauthenticated, nil)
		}
		return nil, nil
	}

	claims, err := authService.ValidateToken(parts[1])
	if err != nil {
		if requireAuth {
			return nil, connect.NewError(connect.CodeUnauthenticated, err)
		}
		return nil, nil
	}

	return claims, nil
}

func parseStaffRole(r string) restaurantv1.StaffRole {
	switch strings.ToUpper(r) {
	case "ADMIN", "OWNER":
		return restaurantv1.StaffRole_STAFF_ROLE_ADMIN
	case "MANAGER":
		return restaurantv1.StaffRole_STAFF_ROLE_MANAGER
	case "WAITER":
		return restaurantv1.StaffRole_STAFF_ROLE_WAITER
	case "KITCHEN":
		return restaurantv1.StaffRole_STAFF_ROLE_KITCHEN
	case "CASHIER":
		return restaurantv1.StaffRole_STAFF_ROLE_CASHIER
	default:
		return restaurantv1.StaffRole_STAFF_ROLE_UNSPECIFIED
	}
}

func toProtoStaffUser(u *models.StaffUser) *restaurantv1.StaffUser {
	if u == nil {
		return nil
	}
	return &restaurantv1.StaffUser{
		Id:           u.ID,
		RestaurantId: u.RestaurantID,
		BranchId:     u.BranchID,
		Username:     u.Username,
		Name:         u.Name,
		Role:         parseStaffRole(u.Role),
		IsActive:     u.IsActive,
		CreatedAt:    u.CreatedAt.Format(time.RFC3339),
	}
}

func parseOrderStatus(s string) restaurantv1.OrderStatus {
	switch strings.ToUpper(s) {
	case "NEW":
		return restaurantv1.OrderStatus_ORDER_STATUS_NEW
	case "CONFIRMED":
		return restaurantv1.OrderStatus_ORDER_STATUS_CONFIRMED
	case "PREPARING":
		return restaurantv1.OrderStatus_ORDER_STATUS_PREPARING
	case "READY":
		return restaurantv1.OrderStatus_ORDER_STATUS_READY
	case "SERVED":
		return restaurantv1.OrderStatus_ORDER_STATUS_SERVED
	case "CANCELLED":
		return restaurantv1.OrderStatus_ORDER_STATUS_CANCELLED
	default:
		return restaurantv1.OrderStatus_ORDER_STATUS_UNSPECIFIED
	}
}

func fromProtoOrderStatus(s restaurantv1.OrderStatus) models.OrderStatus {
	switch s {
	case restaurantv1.OrderStatus_ORDER_STATUS_NEW:
		return models.StatusNew
	case restaurantv1.OrderStatus_ORDER_STATUS_CONFIRMED:
		return models.StatusConfirmed
	case restaurantv1.OrderStatus_ORDER_STATUS_PREPARING:
		return models.StatusPreparing
	case restaurantv1.OrderStatus_ORDER_STATUS_READY:
		return models.StatusReady
	case restaurantv1.OrderStatus_ORDER_STATUS_SERVED:
		return models.StatusServed
	case restaurantv1.OrderStatus_ORDER_STATUS_CANCELLED:
		return models.StatusCancelled
	default:
		return ""
	}
}

func parseOrderType(t string) restaurantv1.OrderType {
	switch strings.ToUpper(t) {
	case "DINE_IN":
		return restaurantv1.OrderType_ORDER_TYPE_DINE_IN
	case "TAKEAWAY":
		return restaurantv1.OrderType_ORDER_TYPE_TAKEAWAY
	default:
		return restaurantv1.OrderType_ORDER_TYPE_UNSPECIFIED
	}
}

func fromProtoOrderType(t restaurantv1.OrderType) models.OrderType {
	switch t {
	case restaurantv1.OrderType_ORDER_TYPE_DINE_IN:
		return models.OrderTypeDineIn
	case restaurantv1.OrderType_ORDER_TYPE_TAKEAWAY:
		return models.OrderTypeTakeaway
	default:
		return models.OrderTypeDineIn
	}
}

func parsePaymentStatus(p string) restaurantv1.PaymentStatus {
	switch strings.ToUpper(p) {
	case "PAID":
		return restaurantv1.PaymentStatus_PAYMENT_STATUS_PAID
	case "REFUNDED":
		return restaurantv1.PaymentStatus_PAYMENT_STATUS_REFUNDED
	default:
		return restaurantv1.PaymentStatus_PAYMENT_STATUS_PENDING
	}
}

func toProtoOrder(o *models.Order) *restaurantv1.Order {
	if o == nil {
		return nil
	}

	items := make([]*restaurantv1.OrderItem, 0, len(o.Items))
	for _, it := range o.Items {
		options := make([]*restaurantv1.SelectedOptionSnapshot, 0, len(it.SelectedOptions))
		for _, opt := range it.SelectedOptions {
			options = append(options, &restaurantv1.SelectedOptionSnapshot{
				GroupId:      opt.GroupID,
				GroupNameAr:  opt.GroupNameAr,
				OptionId:     opt.OptionID,
				OptionNameAr: opt.OptionNameAr,
				PriceDelta:   opt.PriceDelta,
			})
		}
		items = append(items, &restaurantv1.OrderItem{
			Id:                  it.ID,
			ProductId:           it.ProductID,
			ProductNameSnapshot: it.ProductNameSnapshot,
			UnitPriceSnapshot:   it.UnitPriceSnapshot,
			Quantity:            int32(it.Quantity),
			SelectedOptions:     options,
			Notes:               it.Notes,
			LineTotal:           it.LineTotal,
		})
	}

	events := make([]*restaurantv1.OrderEvent, 0, len(o.Events))
	for _, ev := range o.Events {
		events = append(events, &restaurantv1.OrderEvent{
			Id:        ev.ID,
			Timestamp: ev.Timestamp,
			Status:    parseOrderStatus(string(ev.Status)),
			Actor:     ev.Actor,
			Note:      ev.Note,
		})
	}

	return &restaurantv1.Order{
		Id:                 o.ID,
		OrderNumber:        o.OrderNumber,
		OrderType:          parseOrderType(string(o.OrderType)),
		RestaurantId:       o.RestaurantID,
		BranchId:           o.BranchID,
		TableId:            o.TableID,
		TableName:          o.TableName,
		TableNameSnapshot:  o.TableNameSnapshot,
		SessionId:          o.SessionID,
		Status:             parseOrderStatus(string(o.Status)),
		Items:              items,
		Subtotal:           o.Subtotal,
		Discount:           o.Discount,
		Tax:                o.Tax,
		Fee:                o.Fee,
		Total:              o.Total,
		PaymentStatus:      parsePaymentStatus(string(o.PaymentStatus)),
		CreatedAt:          o.CreatedAt,
		UpdatedAt:          o.UpdatedAt,
		Events:             events,
		CancellationReason: o.CancellationReason,
		CancelledAt:        o.CancelledAt,
		CancelledBy:        o.CancelledBy,
		LatestActor:        o.LatestActor,
	}
}
