package repositories

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/lib/pq"

	"smart-restaurant-api/internal/database"
	"smart-restaurant-api/internal/models"
)

type OrderRepository struct {
	db *database.DB
}

func NewOrderRepository(db *database.DB) *OrderRepository {
	return &OrderRepository{db: db}
}

func (r *OrderRepository) GetActiveOrders(restaurantID string) ([]models.Order, error) {
	query := `
		SELECT id, order_number, restaurant_id, COALESCE(branch_id, ''), COALESCE(table_id, ''), COALESCE(table_name, 'طلب سفري'),
		       status, subtotal, total, payment_status, created_at, updated_at, session_id, COALESCE(order_type, 'DINE_IN')
		FROM orders
		WHERE status IN ('NEW', 'CONFIRMED', 'PREPARING', 'READY')
	`
	args := []interface{}{}
	if restaurantID != "" {
		query += " AND restaurant_id = $1"
		args = append(args, restaurantID)
	}
	// FIFO ordering for kitchen/service
	query += " ORDER BY created_at ASC"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("error querying active orders: %w", err)
	}
	defer rows.Close()

	var orders []models.Order
	for rows.Next() {
		o, err := r.scanOrderSummary(rows)
		if err != nil {
			return nil, err
		}
		orders = append(orders, *o)
	}

	// Populate items and events
	for i := range orders {
		items, err := r.GetOrderItems(orders[i].ID)
		if err != nil {
			return nil, err
		}
		orders[i].Items = items

		events, err := r.GetOrderEvents(orders[i].ID)
		if err != nil {
			return nil, err
		}
		orders[i].Events = events
	}

	if orders == nil {
		orders = []models.Order{}
	}
	return orders, nil
}

func (r *OrderRepository) GetHistoricalOrders(restaurantID string) ([]models.Order, error) {
	query := `
		SELECT id, order_number, restaurant_id, COALESCE(branch_id, ''), COALESCE(table_id, ''), COALESCE(table_name, 'طلب سفري'),
		       status, subtotal, total, payment_status, created_at, updated_at, session_id, COALESCE(order_type, 'DINE_IN')
		FROM orders
		WHERE status IN ('SERVED', 'CANCELLED')
	`
	args := []interface{}{}
	if restaurantID != "" {
		query += " AND restaurant_id = $1"
		args = append(args, restaurantID)
	}
	query += " ORDER BY updated_at DESC, created_at DESC"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("error querying historical orders: %w", err)
	}
	defer rows.Close()

	var orders []models.Order
	for rows.Next() {
		o, err := r.scanOrderSummary(rows)
		if err != nil {
			return nil, err
		}
		orders = append(orders, *o)
	}

	for i := range orders {
		items, err := r.GetOrderItems(orders[i].ID)
		if err != nil {
			return nil, err
		}
		orders[i].Items = items

		events, err := r.GetOrderEvents(orders[i].ID)
		if err != nil {
			return nil, err
		}
		orders[i].Events = events
	}

	if orders == nil {
		orders = []models.Order{}
	}
	return orders, nil
}

func (r *OrderRepository) GetOrderByID(orderID string) (*models.Order, error) {
	query := `
		SELECT id, order_number, restaurant_id, COALESCE(branch_id, ''), COALESCE(table_id, ''), COALESCE(table_name, 'طلب سفري'),
		       status, subtotal, total, payment_status, created_at, updated_at, session_id, COALESCE(order_type, 'DINE_IN')
		FROM orders
		WHERE id = $1
	`
	row := r.db.QueryRow(query, orderID)

	var o models.Order
	var createdAt, updatedAt time.Time
	var sessionID sql.NullString
	var orderType string
	err := row.Scan(
		&o.ID,
		&o.OrderNumber,
		&o.RestaurantID,
		&o.BranchID,
		&o.TableID,
		&o.TableName,
		&o.Status,
		&o.Subtotal,
		&o.Total,
		&o.PaymentStatus,
		&createdAt,
		&updatedAt,
		&sessionID,
		&orderType,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying order %s: %w", orderID, err)
	}

	o.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	o.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	o.TableNameSnapshot = o.TableName
	o.OrderType = models.OrderType(orderType)
	if sessionID.Valid {
		str := sessionID.String
		o.SessionID = &str
	}

	items, err := r.GetOrderItems(o.ID)
	if err != nil {
		return nil, err
	}
	o.Items = items

	events, err := r.GetOrderEvents(o.ID)
	if err != nil {
		return nil, err
	}
	o.Events = events

	if o.Subtotal > o.Total {
		o.Discount = o.Subtotal - o.Total
	} else {
		o.Discount = 0
	}
	o.Tax = 0
	o.Fee = 0

	if len(events) > 0 {
		o.LatestActor = events[len(events)-1].Actor
		for _, ev := range events {
			if ev.Status == models.StatusCancelled {
				reason := ev.Note
				if strings.HasPrefix(reason, "سبب الإلغاء: ") {
					reason = strings.TrimPrefix(reason, "سبب الإلغاء: ")
				}
				o.CancellationReason = &reason
				ts := ev.Timestamp
				o.CancelledAt = &ts
				act := ev.Actor
				o.CancelledBy = &act
				break
			}
		}
	}

	return &o, nil
}

func (r *OrderRepository) GetOrderEvents(orderID string) ([]models.OrderEvent, error) {
	query := `
		SELECT id, status, actor, COALESCE(note, ''), timestamp
		FROM order_status_events
		WHERE order_id = $1
		ORDER BY timestamp ASC
	`
	rows, err := r.db.Query(query, orderID)
	if err != nil {
		return nil, fmt.Errorf("error querying order events: %w", err)
	}
	defer rows.Close()

	var events []models.OrderEvent
	for rows.Next() {
		var ev models.OrderEvent
		var ts time.Time
		if err := rows.Scan(&ev.ID, &ev.Status, &ev.Actor, &ev.Note, &ts); err != nil {
			return nil, err
		}
		ev.Timestamp = ts.UTC().Format(time.RFC3339)
		events = append(events, ev)
	}

	if events == nil {
		events = []models.OrderEvent{}
	}
	return events, nil
}

func (r *OrderRepository) scanOrderSummary(rows *sql.Rows) (*models.Order, error) {
	var o models.Order
	var createdAt, updatedAt time.Time
	var sessionID sql.NullString
	var orderType string
	err := rows.Scan(
		&o.ID,
		&o.OrderNumber,
		&o.RestaurantID,
		&o.BranchID,
		&o.TableID,
		&o.TableName,
		&o.Status,
		&o.Subtotal,
		&o.Total,
		&o.PaymentStatus,
		&createdAt,
		&updatedAt,
		&sessionID,
		&orderType,
	)
	if err != nil {
		return nil, err
	}
	o.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	o.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	o.TableNameSnapshot = o.TableName
	o.OrderType = models.OrderType(orderType)
	if sessionID.Valid {
		str := sessionID.String
		o.SessionID = &str
	}
	return &o, nil
}

func (r *OrderRepository) GetOrderItems(orderID string) ([]models.OrderItem, error) {
	query := `
		SELECT id, product_id, product_name_snapshot, unit_price_snapshot, quantity, COALESCE(notes, ''), line_total
		FROM order_items
		WHERE order_id = $1
		ORDER BY id ASC
	`
	rows, err := r.db.Query(query, orderID)
	if err != nil {
		return nil, fmt.Errorf("error querying order items: %w", err)
	}
	defer rows.Close()

	var items []models.OrderItem
	var itemIDs []string
	itemIndexMap := make(map[string]int)

	for rows.Next() {
		var item models.OrderItem
		if err := rows.Scan(
			&item.ID,
			&item.ProductID,
			&item.ProductNameSnapshot,
			&item.UnitPriceSnapshot,
			&item.Quantity,
			&item.Notes,
			&item.LineTotal,
		); err != nil {
			return nil, err
		}
		item.SelectedOptions = []models.SelectedOptionSnapshot{}
		itemIndexMap[item.ID] = len(items)
		itemIDs = append(itemIDs, item.ID)
		items = append(items, item)
	}

	if len(itemIDs) > 0 {
		optQuery := `
			SELECT order_item_id, group_id, group_name_ar_snapshot, option_id, option_name_ar_snapshot, price_delta_snapshot
			FROM order_item_options
			WHERE order_item_id = ANY($1)
			ORDER BY id ASC
		`
		optRows, err := r.db.Query(optQuery, pq.Array(itemIDs))
		if err == nil {
			defer optRows.Close()
			for optRows.Next() {
				var ordItemID string
				var opt models.SelectedOptionSnapshot
				if err := optRows.Scan(&ordItemID, &opt.GroupID, &opt.GroupNameAr, &opt.OptionID, &opt.OptionNameAr, &opt.PriceDelta); err == nil {
					if idx, ok := itemIndexMap[ordItemID]; ok {
						items[idx].SelectedOptions = append(items[idx].SelectedOptions, opt)
					}
				}
			}
		}
	}

	if items == nil {
		items = []models.OrderItem{}
	}
	return items, nil
}

func (r *OrderRepository) GetLatestOrderForSessionTx(tx *sql.Tx, sessionID string) (*models.Order, error) {
	query := `
		SELECT id, order_number, restaurant_id, COALESCE(branch_id, ''), COALESCE(table_id, ''), COALESCE(table_name, 'طلب سفري'),
		       status, subtotal, total, payment_status, created_at, updated_at, session_id, COALESCE(order_type, 'DINE_IN')
		FROM orders
		WHERE session_id = $1 AND status != 'CANCELLED'
		ORDER BY created_at DESC
		LIMIT 1
		FOR UPDATE
	`
	row := tx.QueryRow(query, sessionID)
	var o models.Order
	var createdAt, updatedAt time.Time
	var sessID sql.NullString
	var orderType string
	err := row.Scan(
		&o.ID,
		&o.OrderNumber,
		&o.RestaurantID,
		&o.BranchID,
		&o.TableID,
		&o.TableName,
		&o.Status,
		&o.Subtotal,
		&o.Total,
		&o.PaymentStatus,
		&createdAt,
		&updatedAt,
		&sessID,
		&orderType,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying latest session order: %w", err)
	}
	o.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	o.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	o.TableNameSnapshot = o.TableName
	o.OrderType = models.OrderType(orderType)
	if sessID.Valid {
		str := sessID.String
		o.SessionID = &str
	}
	return &o, nil
}

func (r *OrderRepository) CreateOrder(order *models.Order) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if err := r.CreateOrderTx(tx, order); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *OrderRepository) CreateOrderTx(tx *sql.Tx, order *models.Order) error {
	var tableIDArg interface{} = order.TableID
	if order.TableID == "" {
		tableIDArg = nil
	}
	var sessionIDArg interface{} = order.SessionID
	if order.SessionID != nil && *order.SessionID == "" {
		sessionIDArg = nil
	}
	var branchIDArg interface{} = order.BranchID
	if order.BranchID == "" {
		branchIDArg = nil
	}
	orderTypeArg := string(order.OrderType)
	if orderTypeArg == "" {
		orderTypeArg = string(models.OrderTypeDineIn)
	}

	// Insert into orders
	queryOrder := `
		INSERT INTO orders (id, order_number, restaurant_id, branch_id, table_id, table_name, session_id, status, subtotal, total, payment_status, order_type, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
	`
	_, err := tx.Exec(
		queryOrder,
		order.ID,
		order.OrderNumber,
		order.RestaurantID,
		branchIDArg,
		tableIDArg,
		order.TableName,
		sessionIDArg,
		order.Status,
		order.Subtotal,
		order.Total,
		order.PaymentStatus,
		orderTypeArg,
	)
	if err != nil {
		return fmt.Errorf("failed to insert order: %w", err)
	}

	// Insert order items & options
	for _, item := range order.Items {
		queryItem := `
			INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, line_total)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`
		_, err = tx.Exec(
			queryItem,
			item.ID,
			order.ID,
			item.ProductID,
			item.ProductNameSnapshot,
			item.UnitPriceSnapshot,
			item.Quantity,
			item.Notes,
			item.LineTotal,
		)
		if err != nil {
			return fmt.Errorf("failed to insert order item %s: %w", item.ID, err)
		}

		for _, opt := range item.SelectedOptions {
			optID := fmt.Sprintf("oio_%s_%s", item.ID, opt.OptionID)
			queryOpt := `
				INSERT INTO order_item_options (id, order_item_id, group_id, group_name_ar_snapshot, option_id, option_name_ar_snapshot, price_delta_snapshot)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`
			_, err = tx.Exec(
				queryOpt,
				optID,
				item.ID,
				opt.GroupID,
				opt.GroupNameAr,
				opt.OptionID,
				opt.OptionNameAr,
				opt.PriceDelta,
			)
			if err != nil {
				return fmt.Errorf("failed to insert order item option: %w", err)
			}
		}
	}

	// Insert events
	for _, ev := range order.Events {
		queryEv := `
			INSERT INTO order_status_events (id, order_id, status, actor, note, timestamp)
			VALUES ($1, $2, $3, $4, $5, NOW())
		`
		_, err = tx.Exec(queryEv, ev.ID, order.ID, ev.Status, ev.Actor, ev.Note)
		if err != nil {
			return fmt.Errorf("failed to insert order event: %w", err)
		}
	}

	return nil
}

func (r *OrderRepository) AppendItemsToOrderTx(tx *sql.Tx, orderID string, items []models.OrderItem, additionalSubtotal float64, ev models.OrderEvent) error {
	// Insert new order items
	for _, item := range items {
		queryItem := `
			INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, line_total)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`
		_, err := tx.Exec(
			queryItem,
			item.ID,
			orderID,
			item.ProductID,
			item.ProductNameSnapshot,
			item.UnitPriceSnapshot,
			item.Quantity,
			item.Notes,
			item.LineTotal,
		)
		if err != nil {
			return fmt.Errorf("failed to insert appended order item %s: %w", item.ID, err)
		}

		for _, opt := range item.SelectedOptions {
			optID := fmt.Sprintf("oio_%s_%s", item.ID, opt.OptionID)
			queryOpt := `
				INSERT INTO order_item_options (id, order_item_id, group_id, group_name_ar_snapshot, option_id, option_name_ar_snapshot, price_delta_snapshot)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`
			_, err = tx.Exec(
				queryOpt,
				optID,
				item.ID,
				opt.GroupID,
				opt.GroupNameAr,
				opt.OptionID,
				opt.OptionNameAr,
				opt.PriceDelta,
			)
			if err != nil {
				return fmt.Errorf("failed to insert appended item option: %w", err)
			}
		}
	}

	// Update order subtotal and total
	updateQuery := `
		UPDATE orders
		SET subtotal = subtotal + $1,
		    total = total + $1,
		    updated_at = NOW()
		WHERE id = $2
	`
	_, err := tx.Exec(updateQuery, additionalSubtotal, orderID)
	if err != nil {
		return fmt.Errorf("failed to update order totals: %w", err)
	}

	// Insert audit event
	queryEv := `
		INSERT INTO order_status_events (id, order_id, status, actor, note, timestamp)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`
	_, err = tx.Exec(queryEv, ev.ID, orderID, ev.Status, ev.Actor, ev.Note)
	if err != nil {
		return fmt.Errorf("failed to insert audit event for appended items: %w", err)
	}

	return nil
}

func (r *OrderRepository) BeginTx() (*sql.Tx, error) {
	return r.db.Begin()
}

func (r *OrderRepository) UpdateOrderStatus(orderID string, newStatus models.OrderStatus, paymentStatus models.PaymentStatus, actor, note string, eventID string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if err := r.UpdateOrderStatusTx(tx, orderID, newStatus, paymentStatus, actor, note, eventID); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit update order status transaction: %w", err)
	}

	return nil
}

func (r *OrderRepository) UpdateOrderStatusTx(tx *sql.Tx, orderID string, newStatus models.OrderStatus, paymentStatus models.PaymentStatus, actor, note string, eventID string) error {
	queryUpdate := `
		UPDATE orders
		SET status = $1, payment_status = $2, updated_at = NOW()
		WHERE id = $3
	`
	res, err := tx.Exec(queryUpdate, newStatus, paymentStatus, orderID)
	if err != nil {
		return fmt.Errorf("failed to update order status: %w", err)
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("order not found")
	}

	queryEvent := `
		INSERT INTO order_status_events (id, order_id, status, actor, note, timestamp)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`
	_, err = tx.Exec(queryEvent, eventID, orderID, newStatus, actor, note)
	if err != nil {
		return fmt.Errorf("failed to insert audit event: %w", err)
	}

	return nil
}
