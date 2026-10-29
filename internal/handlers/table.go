package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/services"
)

type TableHandler struct {
	tableService *services.TableService
}

func NewTableHandler(tableService *services.TableService) *TableHandler {
	return &TableHandler{tableService: tableService}
}

func getStaffClaims(c *gin.Context) *services.Claims {
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

// GET /api/v1/tables
func (h *TableHandler) ListTables(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول للوصول إلى هذه الواجهة"})
		return
	}

	var filter models.TableFilterQuery
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "معاملات البحث غير صحيحة", "details": err.Error()})
		return
	}

	if filter.SectionID == "" {
		filter.SectionID = c.Query("section")
	}

	resp, err := h.tableService.ListTables(staff, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GET /api/v1/tables/:tableId
func (h *TableHandler) GetTableDetails(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	tableID := c.Param("tableId")
	table, err := h.tableService.GetTableDetails(staff, tableID)
	if err != nil {
		if strings.Contains(err.Error(), "غير موجودة") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, table)
}

// POST /api/v1/tables
func (h *TableHandler) CreateTable(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	var req models.CreateTableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات الطاولة غير مكتملة أو غير صحيحة", "details": err.Error()})
		return
	}

	table, err := h.tableService.CreateTable(staff, req)
	if err != nil {
		if strings.Contains(err.Error(), "صلاحية غير كافية") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "مسجل بالفعل") {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "سعة الطاولة") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, table)
}

// PATCH /api/v1/tables/:tableId
func (h *TableHandler) UpdateTable(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	tableID := c.Param("tableId")
	var req models.UpdateTableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات التحديث غير صحيحة", "details": err.Error()})
		return
	}

	table, err := h.tableService.UpdateTable(staff, tableID, req)
	if err != nil {
		if strings.Contains(err.Error(), "غير موجودة") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "لا يمكن") {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, table)
}

// POST /api/v1/tables/:tableId/sessions
func (h *TableHandler) OpenSession(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	tableID := c.Param("tableId")
	var req models.OpenSessionRequest
	_ = c.ShouldBindJSON(&req) // optional body

	session, err := h.tableService.OpenSession(staff, tableID, req)
	if err != nil {
		if strings.Contains(err.Error(), "غير موجودة") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "جلسة مفتوحة بالفعل") || strings.Contains(err.Error(), "خارج الخدمة") {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, session)
}

// POST /api/v1/tables/:tableId/sessions/:sessionId/close
func (h *TableHandler) CloseSession(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	tableID := c.Param("tableId")
	sessionID := c.Param("sessionId")
	var req models.CloseSessionRequest
	_ = c.ShouldBindJSON(&req) // optional body

	session, err := h.tableService.CloseSession(staff, tableID, sessionID, req)
	if err != nil {
		if strings.Contains(err.Error(), "صلاحية غير كافية") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "غير موجودة") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "لا يمكن إنهاء الجلسة") {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, session)
}

// GET /api/v1/tables/:tableId/active-order
func (h *TableHandler) GetActiveOrder(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	tableID := c.Param("tableId")
	order, err := h.tableService.GetActiveOrder(staff, tableID)
	if err != nil {
		if strings.Contains(err.Error(), "غير موجودة") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if order == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "لا يوجد طلب نشط حالياً لهذه الطاولة"})
		return
	}

	c.JSON(http.StatusOK, order)
}

// GET /api/v1/sections
func (h *TableHandler) ListSections(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	sections, err := h.tableService.ListSections(staff)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, sections)
}

// POST /api/v1/sections
func (h *TableHandler) CreateSection(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	var req models.CreateSectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات القسم غير صحيحة", "details": err.Error()})
		return
	}

	section, err := h.tableService.CreateSection(staff, req)
	if err != nil {
		if strings.Contains(err.Error(), "صلاحية غير كافية") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, section)
}

// POST /api/v1/public/restaurants/:restaurantSlug/table-validation
func (h *TableHandler) ValidateTableNumber(c *gin.Context) {
	restaurantSlug := c.Param("restaurantSlug")
	if restaurantSlug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "معرف المطعم مطلوب"})
		return
	}

	var req models.TableValidationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "يجب إدخال رقم الطاولة بصيغة صحيحة",
			"details": err.Error(),
		})
		return
	}

	resp, err := h.tableService.ValidateTableForCustomer(restaurantSlug, req.TableNumber)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "غير موجود") {
			c.JSON(http.StatusNotFound, gin.H{"error": errMsg, "canOrder": false})
			return
		}
		if strings.Contains(errMsg, "خارج الخدمة") || strings.Contains(errMsg, "قيد التنظيف") {
			c.JSON(http.StatusConflict, gin.H{"error": errMsg, "canOrder": false})
			return
		}
		if strings.Contains(errMsg, "معطلة") || strings.Contains(errMsg, "يجب إدخال") {
			c.JSON(http.StatusBadRequest, gin.H{"error": errMsg, "canOrder": false})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": errMsg, "canOrder": false})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GET /api/v1/tables/:tableId/qr
func (h *TableHandler) GetTableQR(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	tableID := c.Param("tableId")
	qrResp, err := h.tableService.GetTableQRDetails(staff, tableID)
	if err != nil {
		if strings.Contains(err.Error(), "غير موجودة") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, qrResp)
}

// POST /api/v1/tables/:tableId/qr/regenerate
func (h *TableHandler) RegenerateTableQR(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	tableID := c.Param("tableId")
	qrResp, err := h.tableService.RegenerateTableQR(staff, tableID)
	if err != nil {
		if strings.Contains(err.Error(), "صلاحية غير كافية") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "غير موجودة") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, qrResp)
}

// GET /api/v1/public/qr/:token
func (h *TableHandler) ResolvePublicQR(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "رمز QR مطلوب"})
		return
	}

	resp, err := h.tableService.ResolvePublicQR(token)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "غير صالح") || strings.Contains(errMsg, "غير موجود") {
			c.JSON(http.StatusNotFound, gin.H{"error": errMsg, "canOrder": false})
			return
		}
		if strings.Contains(errMsg, "خارج الخدمة") || strings.Contains(errMsg, "قيد التنظيف") {
			c.JSON(http.StatusConflict, gin.H{"error": errMsg, "canOrder": false})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": errMsg, "canOrder": false})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// PATCH /api/v1/tables/:tableId/toggle-active
func (h *TableHandler) ToggleTableActive(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	tableID := c.Param("tableId")
	var req struct {
		IsActive bool `json:"isActive"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "بيانات غير صحيحة", "details": err.Error()})
		return
	}

	if err := h.tableService.ToggleTableActive(staff, tableID, req.IsActive); err != nil {
		if strings.Contains(err.Error(), "صلاحية غير كافية") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"tableId":  tableID,
		"isActive": req.IsActive,
		"message":  "تم تعديل حالة تفعيل الطاولة بنجاح",
	})
}

// DELETE /api/v1/tables/:tableId
func (h *TableHandler) DeleteTable(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	tableID := c.Param("tableId")
	if err := h.tableService.DeleteTable(staff, tableID); err != nil {
		if strings.Contains(err.Error(), "صلاحية غير كافية") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "لا يمكن حذف الطاولة") {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"tableId": tableID,
		"message": "تم حذف/تعطيل الطاولة بنجاح",
	})
}

// GET /api/v1/admin/tables/:tableId/session or /api/v1/tables/:tableId/session
func (h *TableHandler) GetTableSession(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	tableID := c.Param("tableId")
	session, err := h.tableService.GetTableSession(staff, tableID)
	if err != nil {
		if strings.Contains(err.Error(), "لا توجد جلسة نشطة") || strings.Contains(err.Error(), "غير موجودة") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, session)
}

// GET /api/v1/admin/sessions/:sessionId or /api/v1/sessions/:sessionId
func (h *TableHandler) GetSessionDetails(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	sessionID := c.Param("sessionId")
	session, err := h.tableService.GetSessionDetails(staff, sessionID)
	if err != nil {
		if strings.Contains(err.Error(), "غير موجودة") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, session)
}

// GET /api/v1/admin/sessions/:sessionId/orders
func (h *TableHandler) GetSessionOrders(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	sessionID := c.Param("sessionId")
	orders, err := h.tableService.GetSessionOrders(staff, sessionID)
	if err != nil {
		if strings.Contains(err.Error(), "غير موجودة") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, orders)
}

// POST /api/v1/admin/sessions/:sessionId/close or /api/v1/sessions/:sessionId/close
func (h *TableHandler) CloseSessionDirect(c *gin.Context) {
	staff := getStaffClaims(c)
	if staff == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول"})
		return
	}

	sessionID := c.Param("sessionId")
	var req models.CloseSessionRequest
	_ = c.ShouldBindJSON(&req)

	session, err := h.tableService.CloseSessionDirect(staff, sessionID, req)
	if err != nil {
		if strings.Contains(err.Error(), "غير موجودة") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "صلاحية غير كافية") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "لا يمكن إنهاء الجلسة") {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, session)
}


