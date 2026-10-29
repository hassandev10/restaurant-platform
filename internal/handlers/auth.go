package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/services"
)

type AuthHandler struct {
	authService *services.AuthService
}

func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "يجب إدخال اسم المستخدم وكلمة المرور"})
		return
	}

	res, err := h.authService.Login(req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (h *AuthHandler) GetMe(c *gin.Context) {
	claimsVal, exists := c.Get("claims")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "غير مصرح"})
		return
	}
	claims := claimsVal.(*services.Claims)

	c.JSON(http.StatusOK, gin.H{
		"userId":       claims.UserID,
		"restaurantId": claims.RestaurantID,
		"branchId":     claims.BranchID,
		"username":     claims.Username,
		"name":         claims.Name,
		"role":         claims.Role,
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "تم تسجيل الخروج بنجاح",
	})
}

