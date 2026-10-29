package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/services"
)

type InventoryHandler struct {
	inventoryService *services.InventoryService
}

func NewInventoryHandler(inventoryService *services.InventoryService) *InventoryHandler {
	return &InventoryHandler{inventoryService: inventoryService}
}

func getStaffContext(c *gin.Context) (restaurantID, actorID, actorName, actorRole string) {
	if val, ok := c.Get("restaurantId"); ok && val != nil {
		restaurantID = val.(string)
	}
	if val, ok := c.Get("userId"); ok && val != nil {
		actorID = val.(string)
	}
	if val, ok := c.Get("actorName"); ok && val != nil {
		actorName = val.(string)
	}
	if val, ok := c.Get("role"); ok && val != nil {
		actorRole = val.(string)
	}
	if claimsVal, ok := c.Get("claims"); ok && claimsVal != nil {
		if claims, okCast := claimsVal.(*services.Claims); okCast {
			if restaurantID == "" {
				restaurantID = claims.RestaurantID
			}
			if actorID == "" {
				actorID = claims.UserID
			}
			if actorName == "" {
				actorName = claims.Name
			}
			if actorRole == "" {
				actorRole = claims.Role
			}
		}
	}
	return
}

// ==========================================
// 1. INVENTORY ITEMS
// ==========================================

func (h *InventoryHandler) CreateItem(c *gin.Context) {
	restaurantID, actorID, actorName, _ := getStaffContext(c)
	if restaurantID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "سياق المطعم غير محدد"})
		return
	}

	var req models.CreateInventoryItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات عنصر المخزون غير صالحة", "details": err.Error()})
		return
	}

	item, err := h.inventoryService.CreateItem(restaurantID, actorID, actorName, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, item)
}

func (h *InventoryHandler) GetItem(c *gin.Context) {
	restaurantID, _, _, _ := getStaffContext(c)
	itemID := c.Param("id")

	item, err := h.inventoryService.GetItem(restaurantID, itemID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if item == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "عنصر المخزون غير موجود"})
		return
	}

	c.JSON(http.StatusOK, item)
}

func (h *InventoryHandler) ListItems(c *gin.Context) {
	restaurantID, _, _, _ := getStaffContext(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	search := c.Query("search")
	itemType := c.Query("type")

	var lowStockOnly *bool
	if val := c.Query("low_stock"); val != "" {
		b := strings.ToLower(val) == "true" || val == "1"
		lowStockOnly = &b
	}

	query := models.InventoryItemFilterQuery{
		Search:       search,
		ItemType:     itemType,
		LowStockOnly: lowStockOnly,
		Page:         page,
		PageSize:     pageSize,
	}

	resp, err := h.inventoryService.ListItems(restaurantID, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *InventoryHandler) UpdateItem(c *gin.Context) {
	restaurantID, _, _, _ := getStaffContext(c)
	itemID := c.Param("id")

	var req models.UpdateInventoryItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات التحديث غير صالحة", "details": err.Error()})
		return
	}

	item, err := h.inventoryService.UpdateItem(restaurantID, itemID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, item)
}

// ==========================================
// 2. PURCHASE RECEIPTS
// ==========================================

func (h *InventoryHandler) CreateReceipt(c *gin.Context) {
	restaurantID, actorID, _, _ := getStaffContext(c)
	if restaurantID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "سياق المطعم غير محدد"})
		return
	}

	var req models.CreatePurchaseReceiptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات إذن الاستلام غير صالحة", "details": err.Error()})
		return
	}

	receipt, err := h.inventoryService.CreateReceipt(restaurantID, actorID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, receipt)
}

func (h *InventoryHandler) GetReceipt(c *gin.Context) {
	restaurantID, _, _, _ := getStaffContext(c)
	receiptID := c.Param("id")

	receipt, err := h.inventoryService.GetReceipt(restaurantID, receiptID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if receipt == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "إذن الاستلام غير موجود"})
		return
	}

	c.JSON(http.StatusOK, receipt)
}

func (h *InventoryHandler) ListReceipts(c *gin.Context) {
	restaurantID, _, _, _ := getStaffContext(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")

	query := models.ReceiptFilterQuery{
		Status:   status,
		Page:     page,
		PageSize: pageSize,
	}

	resp, err := h.inventoryService.ListReceipts(restaurantID, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *InventoryHandler) ConfirmReceipt(c *gin.Context) {
	restaurantID, actorID, actorName, _ := getStaffContext(c)
	receiptID := c.Param("id")

	receipt, err := h.inventoryService.ConfirmReceipt(restaurantID, receiptID, actorID, actorName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, receipt)
}

// ==========================================
// 3. INVENTORY ADJUSTMENTS
// ==========================================

func (h *InventoryHandler) ApplyAdjustment(c *gin.Context) {
	restaurantID, actorID, actorName, _ := getStaffContext(c)
	if restaurantID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "سياق المطعم غير محدد"})
		return
	}

	var req models.InventoryAdjustmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات حركة المخزون غير صالحة", "details": err.Error()})
		return
	}

	movement, err := h.inventoryService.ApplyAdjustment(restaurantID, actorID, actorName, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, movement)
}

// ==========================================
// 4. RECIPES
// ==========================================

func (h *InventoryHandler) GetRecipe(c *gin.Context) {
	restaurantID, _, _, _ := getStaffContext(c)
	productID := c.Param("menuItemId")

	recipe, err := h.inventoryService.GetRecipe(restaurantID, productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if recipe == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "لا توجد وصفة مكونات لهذا الصنف"})
		return
	}

	c.JSON(http.StatusOK, recipe)
}

func (h *InventoryHandler) ListRecipes(c *gin.Context) {
	restaurantID, _, _, _ := getStaffContext(c)

	recipes, err := h.inventoryService.ListRecipes(restaurantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, recipes)
}

func (h *InventoryHandler) SaveRecipe(c *gin.Context) {
	restaurantID, _, _, _ := getStaffContext(c)
	productID := c.Param("menuItemId")

	var req models.SaveRecipeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات الوصفة غير صالحة", "details": err.Error()})
		return
	}

	recipe, err := h.inventoryService.SaveRecipe(restaurantID, productID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, recipe)
}

// ==========================================
// 5. MOVEMENTS & AUDIT LEDGER
// ==========================================

func (h *InventoryHandler) ListMovements(c *gin.Context) {
	restaurantID, _, _, _ := getStaffContext(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	itemID := c.Query("item_id")
	movementType := c.Query("movement_type")
	fromDate := c.Query("from_date")
	toDate := c.Query("to_date")

	query := models.InventoryMovementFilterQuery{
		InventoryItemID: itemID,
		MovementType:    movementType,
		From:            fromDate,
		To:              toDate,
		Page:            page,
		PageSize:        pageSize,
	}

	resp, err := h.inventoryService.ListMovements(restaurantID, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// ==========================================
// 6. SUMMARY & VALUATION
// ==========================================

func (h *InventoryHandler) GetSummary(c *gin.Context) {
	restaurantID, _, _, _ := getStaffContext(c)

	summary, err := h.inventoryService.GetSummary(restaurantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// ==========================================
// 7. ALERTS
// ==========================================

func (h *InventoryHandler) ListAlerts(c *gin.Context) {
	restaurantID, _, _, _ := getStaffContext(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")
	alertType := c.Query("alert_type")

	query := models.InventoryAlertFilterQuery{
		Status:    status,
		AlertType: alertType,
		Page:      page,
		PageSize:  pageSize,
	}

	resp, err := h.inventoryService.ListAlerts(restaurantID, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *InventoryHandler) ResolveAlert(c *gin.Context) {
	restaurantID, actorID, _, _ := getStaffContext(c)
	alertID := c.Param("id")

	if err := h.inventoryService.ResolveAlert(restaurantID, alertID, actorID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "تم تسوية التنبيه بنجاح"})
}
