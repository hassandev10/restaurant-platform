package services

import (
	"smart-restaurant-api/internal/models"
)

var NextStatusMap = map[models.OrderStatus]models.OrderStatus{
	models.StatusNew:       models.StatusConfirmed,
	models.StatusConfirmed: models.StatusPreparing,
	models.StatusPreparing: models.StatusReady,
	models.StatusReady:     models.StatusServed,
}

// CanTransitionStatus checks if transitioning from current to target is legally allowed
func CanTransitionStatus(currentStatus, targetStatus models.OrderStatus) bool {
	// Direct forward transition
	if next, ok := NextStatusMap[currentStatus]; ok && next == targetStatus {
		return true
	}

	// Cancellation allowed only from active, unfulfilled states
	if targetStatus == models.StatusCancelled && IsOrderCancellable(currentStatus) {
		return true
	}

	return false
}

// IsOrderCancellable returns true if order can be cancelled
func IsOrderCancellable(status models.OrderStatus) bool {
	return status == models.StatusNew || status == models.StatusConfirmed || status == models.StatusPreparing
}

// GetNextValidStatus returns the next sequential status in standard POS workflow
func GetNextValidStatus(status models.OrderStatus) (models.OrderStatus, bool) {
	next, ok := NextStatusMap[status]
	return next, ok
}
