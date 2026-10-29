package test

import (
	"testing"

	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/services"
)

func TestOrderWorkflowStateTransitions(t *testing.T) {
	// 1. Valid Linear Transitions
	validTransitions := [][2]models.OrderStatus{
		{models.StatusNew, models.StatusConfirmed},
		{models.StatusConfirmed, models.StatusPreparing},
		{models.StatusPreparing, models.StatusReady},
		{models.StatusReady, models.StatusServed},
	}

	for _, tr := range validTransitions {
		if !services.CanTransitionStatus(tr[0], tr[1]) {
			t.Errorf("Expected transition from %s to %s to be valid, but got false", tr[0], tr[1])
		}
	}

	// 2. Illegal Skip Transitions
	illegalTransitions := [][2]models.OrderStatus{
		{models.StatusNew, models.StatusPreparing},
		{models.StatusNew, models.StatusReady},
		{models.StatusNew, models.StatusServed},
		{models.StatusConfirmed, models.StatusReady},
		{models.StatusConfirmed, models.StatusServed},
		{models.StatusPreparing, models.StatusServed},
		{models.StatusServed, models.StatusNew},
		{models.StatusServed, models.StatusPreparing},
		{models.StatusCancelled, models.StatusConfirmed},
	}

	for _, tr := range illegalTransitions {
		if services.CanTransitionStatus(tr[0], tr[1]) {
			t.Errorf("Expected transition from %s to %s to be illegal, but got true", tr[0], tr[1])
		}
	}
}

func TestOrderCancellationRules(t *testing.T) {
	// Active non-terminal states can be cancelled
	cancellable := []models.OrderStatus{
		models.StatusNew,
		models.StatusConfirmed,
		models.StatusPreparing,
	}

	for _, st := range cancellable {
		if !services.IsOrderCancellable(st) {
			t.Errorf("Status %s should be cancellable", st)
		}
		if !services.CanTransitionStatus(st, models.StatusCancelled) {
			t.Errorf("Transition from %s to CANCELLED should be permitted", st)
		}
	}

	// Completed or already cancelled orders cannot be cancelled
	nonCancellable := []models.OrderStatus{
		models.StatusReady,
		models.StatusServed,
		models.StatusCancelled,
	}

	for _, st := range nonCancellable {
		if services.IsOrderCancellable(st) {
			t.Errorf("Status %s must NOT be cancellable", st)
		}
		if services.CanTransitionStatus(st, models.StatusCancelled) {
			t.Errorf("Transition from %s to CANCELLED must NOT be permitted", st)
		}
	}
}

func TestGetNextValidStatus(t *testing.T) {
	next, ok := services.GetNextValidStatus(models.StatusNew)
	if !ok || next != models.StatusConfirmed {
		t.Fatalf("Expected next after NEW to be CONFIRMED, got %s", next)
	}

	next, ok = services.GetNextValidStatus(models.StatusConfirmed)
	if !ok || next != models.StatusPreparing {
		t.Fatalf("Expected next after CONFIRMED to be PREPARING, got %s", next)
	}

	next, ok = services.GetNextValidStatus(models.StatusPreparing)
	if !ok || next != models.StatusReady {
		t.Fatalf("Expected next after PREPARING to be READY, got %s", next)
	}

	next, ok = services.GetNextValidStatus(models.StatusReady)
	if !ok || next != models.StatusServed {
		t.Fatalf("Expected next after READY to be SERVED, got %s", next)
	}

	_, ok = services.GetNextValidStatus(models.StatusServed)
	if ok {
		t.Fatalf("Expected no next status after SERVED")
	}

	_, ok = services.GetNextValidStatus(models.StatusCancelled)
	if ok {
		t.Fatalf("Expected no next status after CANCELLED")
	}
}
