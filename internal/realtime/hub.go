package realtime

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Client struct {
	hub          *Hub
	conn         *websocket.Conn
	send         chan []byte
	restaurantID string
	orderID      string
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(4096)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WS client read error: %v", err)
			}
			break
		}
		var cmd struct {
			Action       string `json:"action"`
			RestaurantID string `json:"restaurantId"`
			OrderID      string `json:"orderId"`
		}
		if err := json.Unmarshal(message, &cmd); err == nil && cmd.Action == "subscribe" {
			c.restaurantID = cmd.RestaurantID
			c.orderID = cmd.OrderID
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)
			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

type Hub struct {
	clients        map[*Client]bool
	broadcast      chan OrderSubscriptionEvent
	tableBroadcast chan TableEvent
	register       chan *Client
	unregister     chan *Client
	mu             sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		broadcast:      make(chan OrderSubscriptionEvent, 256),
		tableBroadcast: make(chan TableEvent, 256),
		register:       make(chan *Client),
		unregister:     make(chan *Client),
		clients:        make(map[*Client]bool),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case event := <-h.broadcast:
			payload, err := json.Marshal(event)
			if err != nil {
				log.Printf("Failed to marshal WS event: %v", err)
				continue
			}

			h.mu.RLock()
			for client := range h.clients {
				// Scope isolation
				if client.restaurantID != "" && client.restaurantID != event.Order.RestaurantID {
					continue
				}
				if client.orderID != "" && client.orderID != event.Order.ID {
					continue
				}

				select {
				case client.send <- payload:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()

		case tableEvent := <-h.tableBroadcast:
			payload, err := json.Marshal(tableEvent)
			if err != nil {
				log.Printf("Failed to marshal WS table event: %v", err)
				continue
			}

			h.mu.RLock()
			for client := range h.clients {
				// Tenant isolation: don't broadcast to other restaurants
				if client.restaurantID != "" && client.restaurantID != tableEvent.RestaurantID {
					continue
				}

				select {
				case client.send <- payload:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Broadcast(event OrderSubscriptionEvent) {
	h.broadcast <- event
}

func (h *Hub) BroadcastTableEvent(event TableEvent) {
	h.tableBroadcast <- event
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WS upgrade error: %v", err)
		return
	}

	restaurantID := r.URL.Query().Get("restaurantId")
	orderID := r.URL.Query().Get("orderId")

	client := &Client{
		hub:          h,
		conn:         conn,
		send:         make(chan []byte, 256),
		restaurantID: restaurantID,
		orderID:      orderID,
	}

	h.register <- client

	go client.writePump()
	go client.readPump()
}
