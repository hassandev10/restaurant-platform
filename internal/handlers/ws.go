package handlers

import (
	"github.com/gin-gonic/gin"

	"smart-restaurant-api/internal/realtime"
)

type WSHandler struct {
	hub *realtime.Hub
}

func NewWSHandler(hub *realtime.Hub) *WSHandler {
	return &WSHandler{hub: hub}
}

func (h *WSHandler) HandleWS(c *gin.Context) {
	h.hub.ServeWS(c.Writer, c.Request)
}
