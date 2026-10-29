package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"smart-restaurant-api/internal/services"
)

type DashboardHandler struct {
	orderService *services.OrderService
}

func NewDashboardHandler(orderService *services.OrderService) *DashboardHandler {
	return &DashboardHandler{orderService: orderService}
}

func (h *DashboardHandler) GetActiveOrders(c *gin.Context) {
	restaurantID := c.Query("restaurantId")
	if restaurantID == "" {
		restaurantID = c.Param("restaurantId")
	}
	if restaurantID == "" {
		if ctxRest, exists := c.Get("restaurantId"); exists {
			restaurantID = ctxRest.(string)
		}
	}

	orders, err := h.orderService.GetActiveOrders(restaurantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, orders)
}

func (h *DashboardHandler) GetHistoricalOrders(c *gin.Context) {
	restaurantID := c.Query("restaurantId")
	if restaurantID == "" {
		restaurantID = c.Param("restaurantId")
	}
	if restaurantID == "" {
		if ctxRest, exists := c.Get("restaurantId"); exists {
			restaurantID = ctxRest.(string)
		}
	}

	orders, err := h.orderService.GetHistoricalOrders(restaurantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, orders)
}

func (h *DashboardHandler) SimulateIncomingOrder(c *gin.Context) {
	restaurantID := c.Query("restaurantId")
	if restaurantID == "" {
		if ctxRest, exists := c.Get("restaurantId"); exists {
			restaurantID = ctxRest.(string)
		}
	}
	if restaurantID == "" {
		restaurantID = "rest-01"
	}

	order, err := h.orderService.SimulateIncomingOrder(restaurantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, order)
}
