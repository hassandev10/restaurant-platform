package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/services"
)

type AdminHandler struct {
	adminService *services.AdminService
}

func NewAdminHandler(adminService *services.AdminService) *AdminHandler {
	return &AdminHandler{adminService: adminService}
}

func getAdminStaffClaims(c *gin.Context) *services.Claims {
	claimsVal, exists := c.Get("claims")
	if !exists {
		return nil
	}
	claims, ok := claimsVal.(*services.Claims)
	if !ok {
		return nil
	}
	return claims
}

// ==========================================
// 1. DASHBOARD & ANALYTICS
// ==========================================

func (h *AdminHandler) GetDashboardStats(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	stats, err := h.adminService.GetDashboardStats(staff)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (h *AdminHandler) GetAnalytics(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	from := c.Query("from")
	to := c.Query("to")

	analytics, err := h.adminService.GetAnalytics(staff, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, analytics)
}

// ==========================================
// 2. RESTAURANT SETTINGS
// ==========================================

func (h *AdminHandler) GetRestaurantSettings(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	rest, err := h.adminService.GetRestaurantSettings(staff)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rest)
}

func (h *AdminHandler) UpdateRestaurantSettings(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	var req models.UpdateRestaurantSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات التحديث غير صحيحة", "details": err.Error()})
		return
	}

	rest, err := h.adminService.UpdateRestaurantSettings(staff, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rest)
}

// ==========================================
// 3. CATEGORIES MANAGEMENT
// ==========================================

func (h *AdminHandler) ListCategories(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	categories, err := h.adminService.ListCategories(staff)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, categories)
}

func (h *AdminHandler) CreateCategory(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	var req models.CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات القسم غير صحيحة", "details": err.Error()})
		return
	}

	cat, err := h.adminService.CreateCategory(staff, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, cat)
}

func (h *AdminHandler) GetCategory(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	categoryID := c.Param("id")
	cat, err := h.adminService.GetCategory(staff, categoryID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cat)
}

func (h *AdminHandler) UpdateCategory(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	categoryID := c.Param("id")
	var req models.UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات التحديث غير صحيحة", "details": err.Error()})
		return
	}

	cat, err := h.adminService.UpdateCategory(staff, categoryID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cat)
}

func (h *AdminHandler) DeleteCategory(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	categoryID := c.Param("id")
	if err := h.adminService.DeleteCategory(staff, categoryID); err != nil {
		if strings.Contains(err.Error(), "لا يمكن حذف") {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "تم حذف القسم بنجاح"})
}

func (h *AdminHandler) ReorderCategories(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	var req models.ReorderCategoriesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات الترتيب غير صحيحة", "details": err.Error()})
		return
	}

	if err := h.adminService.ReorderCategories(staff, req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "تم تحديث ترتيب الأقسام بنجاح"})
}

// ==========================================
// 4. PRODUCT MANAGEMENT
// ==========================================

func (h *AdminHandler) ListProducts(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	var query models.ProductFilterQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "معاملات البحث غير صحيحة", "details": err.Error()})
		return
	}

	resp, err := h.adminService.ListProducts(staff, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *AdminHandler) CreateProduct(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	var req models.CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات المنتج غير صحيحة", "details": err.Error()})
		return
	}

	product, err := h.adminService.CreateProduct(staff, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, product)
}

func (h *AdminHandler) GetProduct(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	productID := c.Param("id")
	product, err := h.adminService.GetProduct(staff, productID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, product)
}

func (h *AdminHandler) UpdateProduct(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	productID := c.Param("id")
	var req models.UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات التحديث غير صحيحة", "details": err.Error()})
		return
	}

	product, err := h.adminService.UpdateProduct(staff, productID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, product)
}

func (h *AdminHandler) DeleteProduct(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	productID := c.Param("id")
	if err := h.adminService.DeleteProduct(staff, productID); err != nil {
		if strings.Contains(err.Error(), "لا يمكن حذف") {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "تم حذف/تعطيل المنتج بنجاح"})
}

func (h *AdminHandler) ToggleProductAvailability(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	productID := c.Param("id")
	var req models.ToggleAvailabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات غير صحيحة", "details": err.Error()})
		return
	}

	if err := h.adminService.ToggleProductAvailability(staff, productID, req.IsAvailable); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"productId":   productID,
		"isAvailable": req.IsAvailable,
		"message":     "تم تعديل حالة توفر المنتج بنجاح",
	})
}

// ==========================================
// 5. ORDERS INTEGRATION & LISTING
// ==========================================

func (h *AdminHandler) ListOrders(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	var query models.AdminOrderFilterQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "معاملات البحث غير صحيحة", "details": err.Error()})
		return
	}

	resp, err := h.adminService.ListOrders(staff, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// ==========================================
// 6. PROMOTIONS
// ==========================================

func (h *AdminHandler) ListPromotions(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	promotions, err := h.adminService.ListPromotions(staff)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, promotions)
}

func (h *AdminHandler) CreatePromotion(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	var req models.CreatePromotionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات العرض الترويجي غير صحيحة", "details": err.Error()})
		return
	}

	promo, err := h.adminService.CreatePromotion(staff, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, promo)
}

func (h *AdminHandler) GetPromotion(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	promoID := c.Param("id")
	promo, err := h.adminService.GetPromotion(staff, promoID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, promo)
}

func (h *AdminHandler) UpdatePromotion(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	promoID := c.Param("id")
	var req models.UpdatePromotionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات التحديث غير صحيحة", "details": err.Error()})
		return
	}

	promo, err := h.adminService.UpdatePromotion(staff, promoID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, promo)
}

func (h *AdminHandler) DeletePromotion(c *gin.Context) {
	staff := getAdminStaffClaims(c)
	promoID := c.Param("id")
	if err := h.adminService.DeletePromotion(staff, promoID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "تم حذف العرض الترويجي بنجاح"})
}
