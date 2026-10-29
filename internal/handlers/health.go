package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"smart-restaurant-api/internal/database"
)

var startTime = time.Now()

type HealthHandler struct {
	db *database.DB
}

func NewHealthHandler(db *database.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

func (h *HealthHandler) HealthCheck(c *gin.Context) {
	dbStatus := "connected"
	if err := h.db.Ping(); err != nil {
		dbStatus = "disconnected"
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":   "unhealthy",
			"database": dbStatus,
			"error":    err.Error(),
			"uptime":   time.Since(startTime).String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "smart-restaurant-api",
		"database":  dbStatus,
		"uptime":    time.Since(startTime).String(),
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}
