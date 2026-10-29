package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/services"
)

type OrderHandler struct {
	orderService *services.OrderService
}

func NewOrderHandler(orderService *services.OrderService) *OrderHandler {
	return &OrderHandler{orderService: orderService}
}

func (h *OrderHandler) CreateOrder(c *gin.Context) {
	var req models.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات الطلب غير مكتملة أو غير صحيحة", "details": err.Error()})
		return
	}

	order, err := h.orderService.CreateOrder(req)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, order)
}

func (h *OrderHandler) GetOrderByID(c *gin.Context) {
	orderID := c.Param("orderId")
	order, err := h.orderService.GetOrderByID(orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if order == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "الطلب غير موجود"})
		return
	}

	// Strict multi-tenant isolation: authenticated staff may only view orders belonging to their restaurant
	if restID, exists := c.Get("restaurantId"); exists {
		if restStr, ok := restID.(string); ok && restStr != "" {
			if order.RestaurantID != restStr {
				c.JSON(http.StatusForbidden, gin.H{"error": "غير مصرح لك بالوصول إلى طلبات هذا المطعم"})
				return
			}
		}
	}

	c.JSON(http.StatusOK, order)
}

func (h *OrderHandler) GetOrderEvents(c *gin.Context) {
	orderID := c.Param("orderId")
	events, err := h.orderService.GetOrderEvents(orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, events)
}

func (h *OrderHandler) UpdateOrderStatus(c *gin.Context) {
	orderID := c.Param("orderId")
	var req models.UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "يجب إرسال الحالة الجديدة", "details": err.Error()})
		return
	}

	actor := req.Actor
	if actor == "" {
		if actorName, exists := c.Get("actorName"); exists {
			actor = actorName.(string)
		}
	}

	var actorID string
	if val, exists := c.Get("userId"); exists && val != nil {
		actorID = val.(string)
	} else if val, exists := c.Get("actorId"); exists && val != nil {
		actorID = val.(string)
	}

	var actorRole string
	if val, exists := c.Get("role"); exists && val != nil {
		actorRole = val.(string)
	} else if val, exists := c.Get("actorRole"); exists && val != nil {
		actorRole = val.(string)
	}

	if claimsVal, exists := c.Get("claims"); exists && claimsVal != nil {
		if claims, ok := claimsVal.(*services.Claims); ok {
			if actorID == "" {
				actorID = claims.UserID
			}
			if actorRole == "" {
				actorRole = claims.Role
			}
			if actor == "" {
				actor = claims.Name
			}
		}
	}

	updated, err := h.orderService.UpdateOrderStatusWithOptions(
		orderID,
		req.Status,
		actorID,
		actor,
		actorRole,
		req.Note,
		req.AllowLowStockOverride,
		req.OverrideReason,
	)
	if err != nil {
		var shortageErr *models.InventoryShortageError
		if errors.As(err, &shortageErr) {
			c.JSON(http.StatusConflict, gin.H{
				"error":     shortageErr.Message,
				"shortages": shortageErr.Shortages,
			})
			return
		}
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func (h *OrderHandler) CancelOrder(c *gin.Context) {
	orderID := c.Param("orderId")
	var req models.CancelOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "يجب تحديد سبب الإلغاء", "details": err.Error()})
		return
	}

	actor := req.Actor
	if actor == "" {
		if actorName, exists := c.Get("actorName"); exists {
			actor = actorName.(string)
		}
	}

	cancelled, err := h.orderService.CancelOrder(orderID, req.Reason, actor)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cancelled)
}
