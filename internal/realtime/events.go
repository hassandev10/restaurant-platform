package realtime

import "smart-restaurant-api/internal/models"

type EventType string

const (
	EventCreated   EventType = "CREATED"
	EventUpdated   EventType = "UPDATED"
	EventCancelled EventType = "CANCELLED"
)

type OrderSubscriptionEvent struct {
	Type         EventType    `json:"type"`
	Order        models.Order `json:"order"`
	Timestamp    string       `json:"timestamp"`
	RestaurantID string       `json:"restaurantId,omitempty"`
}

type TableEvent struct {
	EventID      string      `json:"eventId"`
	Type         string      `json:"type"` // table.created, table.updated, table.session.opened, table.session.closed, table.occupancy.changed, order.assigned_to_table, order.cancelled, order.completed
	RestaurantID string      `json:"restaurantId"`
	BranchID     string      `json:"branchId,omitempty"`
	TableID      string      `json:"tableId,omitempty"`
	SessionID    string      `json:"sessionId,omitempty"`
	OrderID      string      `json:"orderId,omitempty"`
	Timestamp    string      `json:"timestamp"`
	Data         interface{} `json:"data"`
}
