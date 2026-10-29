package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"smart-restaurant-api/internal/services"
)

func AuthMiddleware(authService *services.AuthService, requireAuth bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			if requireAuth {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول للوصول إلى هذه الواجهة"})
				c.Abort()
				return
			}
			c.Next()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			if requireAuth {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "صيغة رمز الدخول غير صحيحة"})
				c.Abort()
				return
			}
			c.Next()
			return
		}

		tokenString := parts[1]
		claims, err := authService.ValidateToken(tokenString)
		if err != nil {
			if requireAuth {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "رمز الدخول منتهي الصلاحية أو غير صالح"})
				c.Abort()
				return
			}
			c.Next()
			return
		}

		c.Set("claims", claims)
		c.Set("userId", claims.UserID)
		c.Set("restaurantId", claims.RestaurantID)
		c.Set("role", claims.Role)
		c.Set("actorName", claims.Name)

		c.Next()
	}
}

// RequireRole checks that the authenticated user possesses at least one of the specified roles.
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "يجب تسجيل الدخول للوصول إلى هذه الواجهة"})
			c.Abort()
			return
		}

		userRole := strings.ToUpper(strings.TrimSpace(roleVal.(string)))
		allowed := false
		for _, r := range allowedRoles {
			if userRole == strings.ToUpper(strings.TrimSpace(r)) {
				allowed = true
				break
			}
		}

		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "ليس لديك الصلاحيات الكافية للقيام بهذا الإجراء"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// HasInventoryPermission checks if a role has the specified inventory capability.
func HasInventoryPermission(role string, permission string) bool {
	r := strings.ToUpper(strings.TrimSpace(role))
	switch permission {
	case "inventory.movements.read":
		return r == "ADMIN" || r == "OWNER" || r == "MANAGER" || r == "STAFF" || r == "KITCHEN"
	case "inventory.low_stock.override":
		return r == "ADMIN" || r == "OWNER" || r == "MANAGER"
	default:
		// inventory.items.manage, inventory.purchases.manage, inventory.adjustments.manage, inventory.recipes.manage, inventory.alerts.manage
		return r == "ADMIN" || r == "OWNER" || r == "MANAGER"
	}
}


