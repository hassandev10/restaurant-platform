package repositories

import (
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"

	"smart-restaurant-api/internal/database"
	"smart-restaurant-api/internal/models"
)

type InventoryRepository struct {
	db *database.DB
}

func NewInventoryRepository(db *database.DB) *InventoryRepository {
	return &InventoryRepository{db: db}
}

func (r *InventoryRepository) BeginTx() (*sql.Tx, error) {
	return r.db.Begin()
}

// ==========================================
// 1. INVENTORY ITEMS & BALANCES
// ==========================================

func (r *InventoryRepository) CreateItem(tx *sql.Tx, item *models.InventoryItem, initialQty *float64, actorID, actorName string) (*models.InventoryItem, error) {
	manageTx := false
	if tx == nil {
		var err error
		tx, err = r.db.Begin()
		if err != nil {
			return nil, err
		}
		manageTx = true
		defer tx.Rollback()
	}

	queryItem := `
		INSERT INTO inventory_items (
			id, restaurant_id, sku, name, name_en, description,
			item_type, base_unit, minimum_stock_quantity, cost_per_base_unit,
			is_active, created_at, updated_at
		) VALUES (
			$1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), NULLIF($6, ''),
			$7, $8, $9, $10, $11, NOW(), NOW()
		)
	`
	_, err := tx.Exec(
		queryItem,
		item.ID,
		item.RestaurantID,
		strings.TrimSpace(item.SKU),
		strings.TrimSpace(item.Name),
		strings.TrimSpace(item.NameEn),
		strings.TrimSpace(item.Description),
		item.ItemType,
		strings.ToUpper(strings.TrimSpace(item.BaseUnit)),
		item.MinimumStockQuantity,
		item.CostPerBaseUnit,
		item.IsActive,
	)
	if err != nil {
		return nil, fmt.Errorf("error inserting inventory item: %w", err)
	}

	initBalance := 0.0
	if initialQty != nil {
		initBalance = *initialQty
	}

	queryBalance := `
		INSERT INTO inventory_balances (inventory_item_id, restaurant_id, quantity_on_hand, updated_at)
		VALUES ($1, $2, $3, NOW())
	`
	if _, err := tx.Exec(queryBalance, item.ID, item.RestaurantID, initBalance); err != nil {
		return nil, fmt.Errorf("error creating initial balance: %w", err)
	}

	// If initial quantity is set, log initial movement
	if initBalance != 0.0 {
		movementID := fmt.Sprintf("mov_%s", uuid.New().String()[:8])
		queryMov := `
			INSERT INTO inventory_movements (
				id, restaurant_id, inventory_item_id, movement_type, quantity_delta,
				balance_before, balance_after, unit_cost, total_cost, source_type,
				reason, actor_user_id, actor_name, created_at
			) VALUES (
				$1, $2, $3, 'STOCK_ADJUSTMENT', $4, 0.0000, $4, $5, $6, 'INITIAL_SETUP',
				'رصيد افتتاحي عند إنشاء الصنف', $7, $8, NOW()
			)
		`
		totalCost := initBalance * item.CostPerBaseUnit
		if _, err := tx.Exec(queryMov, movementID, item.RestaurantID, item.ID, initBalance, item.CostPerBaseUnit, totalCost, actorID, actorName); err != nil {
			return nil, fmt.Errorf("error logging initial movement: %w", err)
		}
	}

	if err := r.EvaluateAndRecordAlert(tx, item.RestaurantID, item.ID, initBalance, item.MinimumStockQuantity); err != nil {
		return nil, err
	}

	if manageTx {
		if err := tx.Commit(); err != nil {
			return nil, err
		}
	}

	return r.GetItemByID(item.RestaurantID, item.ID)
}

func (r *InventoryRepository) GetItemByID(restaurantID, itemID string) (*models.InventoryItem, error) {
	query := `
		SELECT 
			i.id, i.restaurant_id, COALESCE(i.sku, ''), i.name, COALESCE(i.name_en, ''),
			COALESCE(i.description, ''), i.item_type, i.base_unit, i.minimum_stock_quantity,
			i.cost_per_base_unit, COALESCE(b.quantity_on_hand, 0.0000), i.is_active,
			i.created_at, i.updated_at
		FROM inventory_items i
		LEFT JOIN inventory_balances b ON i.id = b.inventory_item_id
		WHERE i.id = $1 AND i.restaurant_id = $2
	`
	row := r.db.QueryRow(query, itemID, restaurantID)
	var it models.InventoryItem
	err := row.Scan(
		&it.ID,
		&it.RestaurantID,
		&it.SKU,
		&it.Name,
		&it.NameEn,
		&it.Description,
		&it.ItemType,
		&it.BaseUnit,
		&it.MinimumStockQuantity,
		&it.CostPerBaseUnit,
		&it.QuantityOnHand,
		&it.IsActive,
		&it.CreatedAt,
		&it.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying inventory item: %w", err)
	}
	return &it, nil
}

func (r *InventoryRepository) GetItemByIDForUpdate(tx *sql.Tx, restaurantID, itemID string) (*models.InventoryItem, error) {
	query := `
		SELECT 
			i.id, i.restaurant_id, COALESCE(i.sku, ''), i.name, COALESCE(i.name_en, ''),
			COALESCE(i.description, ''), i.item_type, i.base_unit, i.minimum_stock_quantity,
			i.cost_per_base_unit, COALESCE(b.quantity_on_hand, 0.0000), i.is_active,
			i.created_at, i.updated_at
		FROM inventory_items i
		JOIN inventory_balances b ON i.id = b.inventory_item_id
		WHERE i.id = $1 AND i.restaurant_id = $2
		FOR UPDATE OF b
	`
	row := tx.QueryRow(query, itemID, restaurantID)
	var it models.InventoryItem
	err := row.Scan(
		&it.ID,
		&it.RestaurantID,
		&it.SKU,
		&it.Name,
		&it.NameEn,
		&it.Description,
		&it.ItemType,
		&it.BaseUnit,
		&it.MinimumStockQuantity,
		&it.CostPerBaseUnit,
		&it.QuantityOnHand,
		&it.IsActive,
		&it.CreatedAt,
		&it.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying locked inventory item: %w", err)
	}
	return &it, nil
}

func (r *InventoryRepository) ListItems(restaurantID string, query models.InventoryItemFilterQuery) ([]models.InventoryItem, int, error) {
	baseQuery := `
		FROM inventory_items i
		LEFT JOIN inventory_balances b ON i.id = b.inventory_item_id
		WHERE i.restaurant_id = $1
	`
	args := []interface{}{restaurantID}
	argIdx := 2

	if query.ItemType != "" && query.ItemType != "ALL" {
		baseQuery += fmt.Sprintf(" AND i.item_type = $%d", argIdx)
		args = append(args, query.ItemType)
		argIdx++
	}

	if query.IsActive != nil {
		baseQuery += fmt.Sprintf(" AND i.is_active = $%d", argIdx)
		args = append(args, *query.IsActive)
		argIdx++
	}

	if query.LowStockOnly != nil && *query.LowStockOnly {
		baseQuery += " AND b.quantity_on_hand <= i.minimum_stock_quantity"
	}

	if query.Search != "" {
		trimmed := strings.ToLower(strings.TrimSpace(query.Search))
		baseQuery += fmt.Sprintf(" AND (LOWER(i.name) LIKE $%d OR LOWER(COALESCE(i.name_en, '')) LIKE $%d OR LOWER(COALESCE(i.sku, '')) LIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, "%"+trimmed+"%")
		argIdx++
	}

	var total int
	countQuery := "SELECT COUNT(*) " + baseQuery
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("error counting inventory items: %w", err)
	}

	page := query.Page
	if page < 1 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	selectQuery := `
		SELECT 
			i.id, i.restaurant_id, COALESCE(i.sku, ''), i.name, COALESCE(i.name_en, ''),
			COALESCE(i.description, ''), i.item_type, i.base_unit, i.minimum_stock_quantity,
			i.cost_per_base_unit, COALESCE(b.quantity_on_hand, 0.0000), i.is_active,
			i.created_at, i.updated_at
	` + baseQuery + fmt.Sprintf(" ORDER BY i.name ASC LIMIT %d OFFSET %d", pageSize, offset)

	rows, err := r.db.Query(selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("error querying inventory items: %w", err)
	}
	defer rows.Close()

	var items []models.InventoryItem
	for rows.Next() {
		var it models.InventoryItem
		if err := rows.Scan(
			&it.ID,
			&it.RestaurantID,
			&it.SKU,
			&it.Name,
			&it.NameEn,
			&it.Description,
			&it.ItemType,
			&it.BaseUnit,
			&it.MinimumStockQuantity,
			&it.CostPerBaseUnit,
			&it.QuantityOnHand,
			&it.IsActive,
			&it.CreatedAt,
			&it.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		items = append(items, it)
	}
	if items == nil {
		items = []models.InventoryItem{}
	}

	return items, total, nil
}

func (r *InventoryRepository) UpdateItem(restaurantID, itemID string, req models.UpdateInventoryItemRequest) (*models.InventoryItem, error) {
	setClauses := []string{"updated_at = NOW()"}
	args := []interface{}{itemID, restaurantID}
	argIdx := 3

	if req.SKU != nil {
		setClauses = append(setClauses, fmt.Sprintf("sku = NULLIF($%d, '')", argIdx))
		args = append(args, strings.TrimSpace(*req.SKU))
		argIdx++
	}
	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.Name))
		argIdx++
	}
	if req.NameEn != nil {
		setClauses = append(setClauses, fmt.Sprintf("name_en = NULLIF($%d, '')", argIdx))
		args = append(args, strings.TrimSpace(*req.NameEn))
		argIdx++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = NULLIF($%d, '')", argIdx))
		args = append(args, strings.TrimSpace(*req.Description))
		argIdx++
	}
	if req.ItemType != nil {
		setClauses = append(setClauses, fmt.Sprintf("item_type = $%d", argIdx))
		args = append(args, *req.ItemType)
		argIdx++
	}
	if req.BaseUnit != nil {
		setClauses = append(setClauses, fmt.Sprintf("base_unit = $%d", argIdx))
		args = append(args, strings.ToUpper(strings.TrimSpace(*req.BaseUnit)))
		argIdx++
	}
	if req.MinimumStockQuantity != nil {
		setClauses = append(setClauses, fmt.Sprintf("minimum_stock_quantity = $%d", argIdx))
		args = append(args, *req.MinimumStockQuantity)
		argIdx++
	}
	if req.CostPerBaseUnit != nil {
		setClauses = append(setClauses, fmt.Sprintf("cost_per_base_unit = $%d", argIdx))
		args = append(args, *req.CostPerBaseUnit)
		argIdx++
	}
	if req.IsActive != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *req.IsActive)
		argIdx++
	}

	query := fmt.Sprintf("UPDATE inventory_items SET %s WHERE id = $1 AND restaurant_id = $2", strings.Join(setClauses, ", "))
	res, err := r.db.Exec(query, args...)
	if err != nil {
		return nil, fmt.Errorf("error updating inventory item: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return nil, errors.New("صنف المخزون غير موجود")
	}

	return r.GetItemByID(restaurantID, itemID)
}

// ==========================================
// 2. MOVEMENTS & LEDGER
// ==========================================

func (r *InventoryRepository) RecordMovement(tx *sql.Tx, m *models.InventoryMovement) error {
	manageTx := false
	if tx == nil {
		var err error
		tx, err = r.db.Begin()
		if err != nil {
			return err
		}
		manageTx = true
		defer tx.Rollback()
	}

	// Update balance
	queryBalance := `
		UPDATE inventory_balances 
		SET quantity_on_hand = $1, updated_at = NOW()
		WHERE inventory_item_id = $2 AND restaurant_id = $3
	`
	if _, err := tx.Exec(queryBalance, m.BalanceAfter, m.InventoryItemID, m.RestaurantID); err != nil {
		return fmt.Errorf("error updating balance: %w", err)
	}

	// Insert movement
	queryMov := `
		INSERT INTO inventory_movements (
			id, restaurant_id, inventory_item_id, movement_type, quantity_delta,
			balance_before, balance_after, unit_cost, total_cost, source_type,
			source_id, idempotency_key, reason, actor_user_id, actor_name, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			NULLIF($11, ''), NULLIF($12, ''), NULLIF($13, ''), NULLIF($14, ''), NULLIF($15, ''), NOW()
		)
	`
	if _, err := tx.Exec(
		queryMov,
		m.ID,
		m.RestaurantID,
		m.InventoryItemID,
		m.MovementType,
		m.QuantityDelta,
		m.BalanceBefore,
		m.BalanceAfter,
		m.UnitCost,
		m.TotalCost,
		m.SourceType,
		m.SourceID,
		m.IdempotencyKey,
		m.Reason,
		m.ActorUserID,
		m.ActorName,
	); err != nil {
		return fmt.Errorf("error recording inventory movement: %w", err)
	}

	// Fetch item min stock for alert check
	var minStock float64
	_ = tx.QueryRow("SELECT minimum_stock_quantity FROM inventory_items WHERE id = $1", m.InventoryItemID).Scan(&minStock)
	if err := r.EvaluateAndRecordAlert(tx, m.RestaurantID, m.InventoryItemID, m.BalanceAfter, minStock); err != nil {
		return err
	}

	if manageTx {
		return tx.Commit()
	}
	return nil
}

func (r *InventoryRepository) ListMovements(restaurantID string, query models.InventoryMovementFilterQuery) ([]models.InventoryMovement, int, error) {
	baseQuery := `
		FROM inventory_movements m
		JOIN inventory_items i ON m.inventory_item_id = i.id
		WHERE m.restaurant_id = $1
	`
	args := []interface{}{restaurantID}
	argIdx := 2

	if query.InventoryItemID != "" {
		baseQuery += fmt.Sprintf(" AND m.inventory_item_id = $%d", argIdx)
		args = append(args, query.InventoryItemID)
		argIdx++
	}

	if query.MovementType != "" && query.MovementType != "ALL" {
		baseQuery += fmt.Sprintf(" AND m.movement_type = $%d", argIdx)
		args = append(args, query.MovementType)
		argIdx++
	}

	if query.From != "" {
		if tFrom, err := time.Parse(time.RFC3339, query.From); err == nil {
			baseQuery += fmt.Sprintf(" AND m.created_at >= $%d", argIdx)
			args = append(args, tFrom)
			argIdx++
		} else if dFrom, err := time.Parse("2006-01-02", query.From); err == nil {
			baseQuery += fmt.Sprintf(" AND m.created_at >= $%d", argIdx)
			args = append(args, dFrom)
			argIdx++
		}
	}

	if query.To != "" {
		if tTo, err := time.Parse(time.RFC3339, query.To); err == nil {
			baseQuery += fmt.Sprintf(" AND m.created_at <= $%d", argIdx)
			args = append(args, tTo)
			argIdx++
		} else if dTo, err := time.Parse("2006-01-02", query.To); err == nil {
			baseQuery += fmt.Sprintf(" AND m.created_at <= $%d", argIdx)
			args = append(args, dTo.Add(24*time.Hour))
			argIdx++
		}
	}

	var total int
	countQuery := "SELECT COUNT(*) " + baseQuery
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("error counting movements: %w", err)
	}

	page := query.Page
	if page < 1 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	selectQuery := `
		SELECT 
			m.id, m.restaurant_id, m.inventory_item_id, i.name, m.movement_type,
			m.quantity_delta, m.balance_before, m.balance_after, m.unit_cost, m.total_cost,
			m.source_type, COALESCE(m.source_id, ''), COALESCE(m.idempotency_key, ''),
			COALESCE(m.reason, ''), COALESCE(m.actor_user_id, ''), COALESCE(m.actor_name, ''),
			m.created_at
	` + baseQuery + fmt.Sprintf(" ORDER BY m.created_at DESC LIMIT %d OFFSET %d", pageSize, offset)

	rows, err := r.db.Query(selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("error querying movements: %w", err)
	}
	defer rows.Close()

	var movements []models.InventoryMovement
	for rows.Next() {
		var mov models.InventoryMovement
		var createdAt time.Time
		if err := rows.Scan(
			&mov.ID,
			&mov.RestaurantID,
			&mov.InventoryItemID,
			&mov.ItemName,
			&mov.MovementType,
			&mov.QuantityDelta,
			&mov.BalanceBefore,
			&mov.BalanceAfter,
			&mov.UnitCost,
			&mov.TotalCost,
			&mov.SourceType,
			&mov.SourceID,
			&mov.IdempotencyKey,
			&mov.Reason,
			&mov.ActorUserID,
			&mov.ActorName,
			&createdAt,
		); err != nil {
			return nil, 0, err
		}
		mov.CreatedAt = createdAt.Format(time.RFC3339)
		movements = append(movements, mov)
	}
	if movements == nil {
		movements = []models.InventoryMovement{}
	}

	return movements, total, nil
}

// ==========================================
// 3. PURCHASE RECEIPTS
// ==========================================

func (r *InventoryRepository) CreateReceipt(restaurantID, createdBy string, req models.CreatePurchaseReceiptRequest) (*models.PurchaseReceipt, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	receiptID := fmt.Sprintf("rec_%s", uuid.New().String()[:8])
	var totalCost float64 = 0.0

	// Calculate line items server-side
	type processedItem struct {
		id           string
		itemID       string
		purchQty     float64
		purchUnit    string
		convFactor   float64
		baseQty      float64
		unitCost     float64
		lineTotal    float64
	}
	var itemsToInsert []processedItem

	for _, itReq := range req.Items {
		// verify item exists and belongs to restaurant
		var itemExists bool
		err := tx.QueryRow("SELECT EXISTS(SELECT 1 FROM inventory_items WHERE id = $1 AND restaurant_id = $2 AND is_active = true)", itReq.InventoryItemID, restaurantID).Scan(&itemExists)
		if err != nil || !itemExists {
			return nil, fmt.Errorf("صنف المخزون %s غير موجود أو غير نشط في هذا المطعم", itReq.InventoryItemID)
		}

		baseQty := itReq.PurchaseQuantity * itReq.ConversionFactor
		lineTotal := itReq.PurchaseQuantity * itReq.UnitCost
		totalCost += lineTotal

		itemsToInsert = append(itemsToInsert, processedItem{
			id:         fmt.Sprintf("ritem_%s", uuid.New().String()[:8]),
			itemID:     itReq.InventoryItemID,
			purchQty:   itReq.PurchaseQuantity,
			purchUnit:  strings.ToUpper(strings.TrimSpace(itReq.PurchaseUnit)),
			convFactor: itReq.ConversionFactor,
			baseQty:    baseQty,
			unitCost:   itReq.UnitCost,
			lineTotal:  lineTotal,
		})
	}

	queryReceipt := `
		INSERT INTO purchase_receipts (
			id, restaurant_id, receipt_reference, supplier_name, status,
			total_cost, notes, created_by, created_at
		) VALUES (
			$1, $2, $3, NULLIF($4, ''), 'DRAFT',
			$5, NULLIF($6, ''), NULLIF($7, ''), NOW()
		)
	`
	_, err = tx.Exec(
		queryReceipt,
		receiptID,
		restaurantID,
		strings.TrimSpace(req.ReceiptReference),
		strings.TrimSpace(req.SupplierName),
		totalCost,
		strings.TrimSpace(req.Notes),
		createdBy,
	)
	if err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate key") {
			return nil, errors.New("رقم إذن الاستلام مسجل مسبقاً في هذا المطعم")
		}
		return nil, fmt.Errorf("error inserting purchase receipt: %w", err)
	}

	queryItem := `
		INSERT INTO purchase_receipt_items (
			id, purchase_receipt_id, inventory_item_id, purchase_quantity,
			purchase_unit, conversion_factor, base_quantity, unit_cost, line_total
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9
		)
	`
	for _, it := range itemsToInsert {
		if _, err := tx.Exec(
			queryItem,
			it.id,
			receiptID,
			it.itemID,
			it.purchQty,
			it.purchUnit,
			it.convFactor,
			it.baseQty,
			it.unitCost,
			it.lineTotal,
		); err != nil {
			return nil, fmt.Errorf("error inserting receipt item: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return r.GetReceiptByID(restaurantID, receiptID)
}

func (r *InventoryRepository) GetReceiptByID(restaurantID, receiptID string) (*models.PurchaseReceipt, error) {
	query := `
		SELECT 
			r.id, r.restaurant_id, r.receipt_reference, COALESCE(r.supplier_name, ''),
			r.status, r.total_cost, COALESCE(r.notes, ''), COALESCE(r.created_by, ''),
			COALESCE(u1.name, ''), COALESCE(r.confirmed_by, ''), COALESCE(u2.name, ''),
			r.created_at, r.confirmed_at
		FROM purchase_receipts r
		LEFT JOIN staff_users u1 ON r.created_by = u1.id
		LEFT JOIN staff_users u2 ON r.confirmed_by = u2.id
		WHERE r.id = $1 AND r.restaurant_id = $2
	`
	row := r.db.QueryRow(query, receiptID, restaurantID)
	var rec models.PurchaseReceipt
	var createdAt time.Time
	var confirmedAt sql.NullTime
	err := row.Scan(
		&rec.ID,
		&rec.RestaurantID,
		&rec.ReceiptReference,
		&rec.SupplierName,
		&rec.Status,
		&rec.TotalCost,
		&rec.Notes,
		&rec.CreatedBy,
		&rec.CreatedByName,
		&rec.ConfirmedBy,
		&rec.ConfirmedByName,
		&createdAt,
		&confirmedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying purchase receipt: %w", err)
	}
	rec.CreatedAt = createdAt.Format(time.RFC3339)
	if confirmedAt.Valid {
		cStr := confirmedAt.Time.Format(time.RFC3339)
		rec.ConfirmedAt = &cStr
	}

	// Fetch line items
	queryItems := `
		SELECT 
			ri.id, ri.purchase_receipt_id, ri.inventory_item_id, i.name, i.base_unit,
			ri.purchase_quantity, ri.purchase_unit, ri.conversion_factor,
			ri.base_quantity, ri.unit_cost, ri.line_total
		FROM purchase_receipt_items ri
		JOIN inventory_items i ON ri.inventory_item_id = i.id
		WHERE ri.purchase_receipt_id = $1
		ORDER BY ri.id ASC
	`
	rows, err := r.db.Query(queryItems, receiptID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.PurchaseReceiptItem
	for rows.Next() {
		var it models.PurchaseReceiptItem
		if err := rows.Scan(
			&it.ID,
			&it.PurchaseReceiptID,
			&it.InventoryItemID,
			&it.ItemName,
			&it.BaseUnit,
			&it.PurchaseQuantity,
			&it.PurchaseUnit,
			&it.ConversionFactor,
			&it.BaseQuantity,
			&it.UnitCost,
			&it.LineTotal,
		); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	if items == nil {
		items = []models.PurchaseReceiptItem{}
	}
	rec.Items = items

	return &rec, nil
}

func (r *InventoryRepository) ListReceipts(restaurantID string, query models.ReceiptFilterQuery) ([]models.PurchaseReceipt, int, error) {
	baseQuery := `
		FROM purchase_receipts r
		LEFT JOIN staff_users u1 ON r.created_by = u1.id
		LEFT JOIN staff_users u2 ON r.confirmed_by = u2.id
		WHERE r.restaurant_id = $1
	`
	args := []interface{}{restaurantID}
	argIdx := 2

	if query.Status != "" && query.Status != "ALL" {
		baseQuery += fmt.Sprintf(" AND r.status = $%d", argIdx)
		args = append(args, query.Status)
		argIdx++
	}

	if query.Search != "" {
		trimmed := strings.ToLower(strings.TrimSpace(query.Search))
		baseQuery += fmt.Sprintf(" AND (LOWER(r.receipt_reference) LIKE $%d OR LOWER(COALESCE(r.supplier_name, '')) LIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+trimmed+"%")
		argIdx++
	}

	if query.From != "" {
		if tFrom, err := time.Parse(time.RFC3339, query.From); err == nil {
			baseQuery += fmt.Sprintf(" AND r.created_at >= $%d", argIdx)
			args = append(args, tFrom)
			argIdx++
		} else if dFrom, err := time.Parse("2006-01-02", query.From); err == nil {
			baseQuery += fmt.Sprintf(" AND r.created_at >= $%d", argIdx)
			args = append(args, dFrom)
			argIdx++
		}
	}

	if query.To != "" {
		if tTo, err := time.Parse(time.RFC3339, query.To); err == nil {
			baseQuery += fmt.Sprintf(" AND r.created_at <= $%d", argIdx)
			args = append(args, tTo)
			argIdx++
		} else if dTo, err := time.Parse("2006-01-02", query.To); err == nil {
			baseQuery += fmt.Sprintf(" AND r.created_at <= $%d", argIdx)
			args = append(args, dTo.Add(24*time.Hour))
			argIdx++
		}
	}

	var total int
	countQuery := "SELECT COUNT(*) " + baseQuery
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("error counting receipts: %w", err)
	}

	page := query.Page
	if page < 1 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	selectQuery := `
		SELECT 
			r.id, r.restaurant_id, r.receipt_reference, COALESCE(r.supplier_name, ''),
			r.status, r.total_cost, COALESCE(r.notes, ''), COALESCE(r.created_by, ''),
			COALESCE(u1.name, ''), COALESCE(r.confirmed_by, ''), COALESCE(u2.name, ''),
			r.created_at, r.confirmed_at
	` + baseQuery + fmt.Sprintf(" ORDER BY r.created_at DESC LIMIT %d OFFSET %d", pageSize, offset)

	rows, err := r.db.Query(selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("error querying receipts: %w", err)
	}
	defer rows.Close()

	var receipts []models.PurchaseReceipt
	for rows.Next() {
		var rec models.PurchaseReceipt
		var createdAt time.Time
		var confirmedAt sql.NullTime
		if err := rows.Scan(
			&rec.ID,
			&rec.RestaurantID,
			&rec.ReceiptReference,
			&rec.SupplierName,
			&rec.Status,
			&rec.TotalCost,
			&rec.Notes,
			&rec.CreatedBy,
			&rec.CreatedByName,
			&rec.ConfirmedBy,
			&rec.ConfirmedByName,
			&createdAt,
			&confirmedAt,
		); err != nil {
			return nil, 0, err
		}
		rec.CreatedAt = createdAt.Format(time.RFC3339)
		if confirmedAt.Valid {
			cStr := confirmedAt.Time.Format(time.RFC3339)
			rec.ConfirmedAt = &cStr
		}
		receipts = append(receipts, rec)
	}
	if receipts == nil {
		receipts = []models.PurchaseReceipt{}
	}

	return receipts, total, nil
}

func (r *InventoryRepository) ConfirmReceipt(restaurantID, receiptID, confirmedBy, confirmedByName string) (*models.PurchaseReceipt, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 1. Lock receipt row and verify DRAFT status
	var currentStatus string
	var receiptRef string
	err = tx.QueryRow(`
		SELECT status, receipt_reference 
		FROM purchase_receipts 
		WHERE id = $1 AND restaurant_id = $2 
		FOR UPDATE
	`, receiptID, restaurantID).Scan(&currentStatus, &receiptRef)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("إذن الاستلام غير موجود")
		}
		return nil, err
	}

	if currentStatus == "CONFIRMED" {
		tx.Rollback()
		return r.GetReceiptByID(restaurantID, receiptID)
	}

	// 2. Query line items
	queryItems := `
		SELECT inventory_item_id, purchase_quantity, conversion_factor, base_quantity, unit_cost
		FROM purchase_receipt_items
		WHERE purchase_receipt_id = $1
	`
	rows, err := tx.Query(queryItems, receiptID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type receiptItemData struct {
		itemID     string
		baseQty    float64
		unitCost   float64
		convFactor float64
	}
	var items []receiptItemData
	for rows.Next() {
		var it receiptItemData
		var pQty float64
		if err := rows.Scan(&it.itemID, &pQty, &it.convFactor, &it.baseQty, &it.unitCost); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	rows.Close()

	// 3. Atomically lock balances, update balances, record movements, update cost per base unit
	for _, it := range items {
		// Lock balance
		var currentQty float64
		err := tx.QueryRow("SELECT quantity_on_hand FROM inventory_balances WHERE inventory_item_id = $1 AND restaurant_id = $2 FOR UPDATE", it.itemID, restaurantID).Scan(&currentQty)
		if err != nil {
			return nil, fmt.Errorf("فشل في استعلام رصيد الصنف %s: %w", it.itemID, err)
		}

		newBalance := currentQty + it.baseQty
		costPerBase := it.unitCost / it.convFactor

		// Update item cost per base unit
		if costPerBase > 0 {
			_, _ = tx.Exec("UPDATE inventory_items SET cost_per_base_unit = $1, updated_at = NOW() WHERE id = $2", costPerBase, it.itemID)
		}

		// Update balance
		if _, err := tx.Exec("UPDATE inventory_balances SET quantity_on_hand = $1, updated_at = NOW() WHERE inventory_item_id = $2", newBalance, it.itemID); err != nil {
			return nil, err
		}

		// Insert movement with idempotency key
		idempKey := fmt.Sprintf("receipt:%s:item:%s", receiptID, it.itemID)
		movID := fmt.Sprintf("mov_%s", uuid.New().String()[:8])
		totalCost := it.baseQty * costPerBase

		queryMov := `
			INSERT INTO inventory_movements (
				id, restaurant_id, inventory_item_id, movement_type, quantity_delta,
				balance_before, balance_after, unit_cost, total_cost, source_type,
				source_id, idempotency_key, reason, actor_user_id, actor_name, created_at
			) VALUES (
				$1, $2, $3, 'PURCHASE_RECEIPT', $4, $5, $6, $7, $8, 'PURCHASE_RECEIPT',
				$9, $10, $11, $12, $13, NOW()
			)
		`
		reason := fmt.Sprintf("استلام مشتريات إذن رقم %s", receiptRef)
		if _, err := tx.Exec(
			queryMov,
			movID,
			restaurantID,
			it.itemID,
			it.baseQty,
			currentQty,
			newBalance,
			costPerBase,
			totalCost,
			receiptID,
			idempKey,
			reason,
			confirmedBy,
			confirmedByName,
		); err != nil {
			return nil, fmt.Errorf("error recording movement for receipt: %w", err)
		}

		// Check and resolve any active alerts if balance restored
		var minStock float64
		_ = tx.QueryRow("SELECT minimum_stock_quantity FROM inventory_items WHERE id = $1", it.itemID).Scan(&minStock)
		if err := r.EvaluateAndRecordAlert(tx, restaurantID, it.itemID, newBalance, minStock); err != nil {
			return nil, err
		}
	}

	// 4. Mark receipt as CONFIRMED
	queryConfirm := `
		UPDATE purchase_receipts
		SET status = 'CONFIRMED', confirmed_at = NOW(), confirmed_by = $1
		WHERE id = $2 AND restaurant_id = $3
	`
	if _, err := tx.Exec(queryConfirm, confirmedBy, receiptID, restaurantID); err != nil {
		return nil, fmt.Errorf("error updating receipt status: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return r.GetReceiptByID(restaurantID, receiptID)
}

// ==========================================
// 4. MANUAL ADJUSTMENTS & STOCK COUNTS
// ==========================================

func (r *InventoryRepository) ApplyAdjustment(restaurantID, actorID, actorName string, req models.InventoryAdjustmentRequest) (*models.InventoryMovement, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 1. Lock item balance row
	var currentQty float64
	var costPerBase float64
	var minStock float64
	var itemName string
	err = tx.QueryRow(`
		SELECT b.quantity_on_hand, i.cost_per_base_unit, i.minimum_stock_quantity, i.name
		FROM inventory_balances b
		JOIN inventory_items i ON b.inventory_item_id = i.id
		WHERE b.inventory_item_id = $1 AND b.restaurant_id = $2
		FOR UPDATE OF b
	`, req.InventoryItemID, restaurantID).Scan(&currentQty, &costPerBase, &minStock, &itemName)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("صنف المخزون غير موجود")
		}
		return nil, err
	}

	// 2. Calculate delta and new balance
	var delta float64
	var mType models.MovementType

	switch req.AdjustmentType {
	case "PHYSICAL_STOCK_COUNT":
		mType = models.MovementStockAdjustment
		delta = req.CountedQuantity - currentQty
	case "WASTE":
		mType = models.MovementWaste
		delta = -math.Abs(req.QuantityDelta)
	case "MANUAL_CONSUMPTION":
		mType = models.MovementManualConsumption
		delta = -math.Abs(req.QuantityDelta)
	case "STOCK_ADJUSTMENT":
		mType = models.MovementStockAdjustment
		delta = req.QuantityDelta
	default:
		return nil, fmt.Errorf("نوع الحركة غير صالح: %s", req.AdjustmentType)
	}

	if delta == 0.0 && req.AdjustmentType != "PHYSICAL_STOCK_COUNT" {
		return nil, errors.New("قيمة التعديل لا يمكن أن تكون صفراً")
	}

	newBalance := currentQty + delta
	totalCost := math.Abs(delta) * costPerBase

	// 3. Update balance
	if _, err := tx.Exec("UPDATE inventory_balances SET quantity_on_hand = $1, updated_at = NOW() WHERE inventory_item_id = $2", newBalance, req.InventoryItemID); err != nil {
		return nil, err
	}

	// 4. Record movement
	movID := fmt.Sprintf("mov_%s", uuid.New().String()[:8])
	reason := req.Reason
	if req.Notes != "" {
		if reason != "" {
			reason = fmt.Sprintf("%s - %s", reason, req.Notes)
		} else {
			reason = req.Notes
		}
	}

	queryMov := `
		INSERT INTO inventory_movements (
			id, restaurant_id, inventory_item_id, movement_type, quantity_delta,
			balance_before, balance_after, unit_cost, total_cost, source_type,
			reason, actor_user_id, actor_name, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			NULLIF($11, ''), NULLIF($12, ''), NULLIF($13, ''), NOW()
		)
	`
	if _, err := tx.Exec(
		queryMov,
		movID,
		restaurantID,
		req.InventoryItemID,
		mType,
		delta,
		currentQty,
		newBalance,
		costPerBase,
		totalCost,
		req.AdjustmentType,
		reason,
		actorID,
		actorName,
	); err != nil {
		return nil, fmt.Errorf("error recording adjustment movement: %w", err)
	}

	// 5. Evaluate alerts
	if err := r.EvaluateAndRecordAlert(tx, restaurantID, req.InventoryItemID, newBalance, minStock); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &models.InventoryMovement{
		ID:              movID,
		RestaurantID:    restaurantID,
		InventoryItemID: req.InventoryItemID,
		ItemName:        itemName,
		MovementType:    mType,
		QuantityDelta:   delta,
		BalanceBefore:   currentQty,
		BalanceAfter:    newBalance,
		UnitCost:        costPerBase,
		TotalCost:       totalCost,
		SourceType:      req.AdjustmentType,
		Reason:          reason,
		ActorUserID:     actorID,
		ActorName:       actorName,
		CreatedAt:       time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// ==========================================
// 5. RECIPES
// ==========================================

func (r *InventoryRepository) GetRecipeByProductID(restaurantID, productID string) (*models.MenuItemRecipe, error) {
	queryRecipe := `
		SELECT r.id, r.restaurant_id, r.menu_product_id, p.name_ar, r.version, r.is_active, COALESCE(r.instructions, ''), r.created_at, r.updated_at
		FROM menu_item_recipes r
		JOIN menu_products p ON r.menu_product_id = p.id
		WHERE r.menu_product_id = $1 AND r.restaurant_id = $2
	`
	row := r.db.QueryRow(queryRecipe, productID, restaurantID)
	var rec models.MenuItemRecipe
	var createdAt, updatedAt time.Time
	err := row.Scan(
		&rec.ID,
		&rec.RestaurantID,
		&rec.MenuProductID,
		&rec.ProductName,
		&rec.Version,
		&rec.IsActive,
		&rec.Instructions,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying recipe: %w", err)
	}
	rec.CreatedAt = createdAt.Format(time.RFC3339)
	rec.UpdatedAt = updatedAt.Format(time.RFC3339)

	// Fetch ingredients
	queryIng := `
		SELECT 
			ri.id, ri.recipe_id, ri.inventory_item_id, i.name, ri.quantity_required, ri.unit,
			ri.applicable_option_id, COALESCE(po.name_ar, '')
		FROM menu_item_recipe_ingredients ri
		JOIN inventory_items i ON ri.inventory_item_id = i.id
		LEFT JOIN product_options po ON ri.applicable_option_id = po.id
		WHERE ri.recipe_id = $1
		ORDER BY ri.id ASC
	`
	rows, err := r.db.Query(queryIng, rec.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ingredients []models.RecipeIngredient
	for rows.Next() {
		var ing models.RecipeIngredient
		var optID, optName sql.NullString
		if err := rows.Scan(
			&ing.ID,
			&ing.RecipeID,
			&ing.InventoryItemID,
			&ing.ItemName,
			&ing.QuantityRequired,
			&ing.Unit,
			&optID,
			&optName,
		); err != nil {
			return nil, err
		}
		if optID.Valid {
			ing.ApplicableOptionID = &optID.String
			ing.ApplicableOptionName = optName.String
		}
		ingredients = append(ingredients, ing)
	}
	if ingredients == nil {
		ingredients = []models.RecipeIngredient{}
	}
	rec.Ingredients = ingredients

	return &rec, nil
}

func (r *InventoryRepository) ListRecipes(restaurantID string) ([]models.MenuItemRecipe, error) {
	query := `
		SELECT r.id, r.restaurant_id, r.menu_product_id, p.name_ar, r.version, r.is_active, COALESCE(r.instructions, ''), r.created_at, r.updated_at
		FROM menu_item_recipes r
		JOIN menu_products p ON r.menu_product_id = p.id
		WHERE r.restaurant_id = $1
		ORDER BY p.name_ar ASC
	`
	rows, err := r.db.Query(query, restaurantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var recipes []models.MenuItemRecipe
	for rows.Next() {
		var rec models.MenuItemRecipe
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&rec.ID,
			&rec.RestaurantID,
			&rec.MenuProductID,
			&rec.ProductName,
			&rec.Version,
			&rec.IsActive,
			&rec.Instructions,
			&createdAt,
			&updatedAt,
		); err != nil {
			return nil, err
		}
		rec.CreatedAt = createdAt.Format(time.RFC3339)
		rec.UpdatedAt = updatedAt.Format(time.RFC3339)
		recipes = append(recipes, rec)
	}

	for i := range recipes {
		ingRows, err := r.db.Query(`
			SELECT 
				ri.id, ri.recipe_id, ri.inventory_item_id, i.name, ri.quantity_required, ri.unit,
				ri.applicable_option_id, COALESCE(po.name_ar, '')
			FROM menu_item_recipe_ingredients ri
			JOIN inventory_items i ON ri.inventory_item_id = i.id
			LEFT JOIN product_options po ON ri.applicable_option_id = po.id
			WHERE ri.recipe_id = $1
		`, recipes[i].ID)
		if err == nil {
			var ings []models.RecipeIngredient
			for ingRows.Next() {
				var ing models.RecipeIngredient
				var optID, optName sql.NullString
				if err := ingRows.Scan(
					&ing.ID,
					&ing.RecipeID,
					&ing.InventoryItemID,
					&ing.ItemName,
					&ing.QuantityRequired,
					&ing.Unit,
					&optID,
					&optName,
				); err == nil {
					if optID.Valid {
						ing.ApplicableOptionID = &optID.String
						ing.ApplicableOptionName = optName.String
					}
					ings = append(ings, ing)
				}
			}
			ingRows.Close()
			recipes[i].Ingredients = ings
		}
		if recipes[i].Ingredients == nil {
			recipes[i].Ingredients = []models.RecipeIngredient{}
		}
	}

	if recipes == nil {
		recipes = []models.MenuItemRecipe{}
	}
	return recipes, nil
}

func (r *InventoryRepository) SaveRecipe(restaurantID, productID string, req models.SaveRecipeRequest) (*models.MenuItemRecipe, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Verify menu product belongs to restaurant
	var prodExists bool
	err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM menu_products WHERE id = $1 AND restaurant_id = $2)", productID, restaurantID).Scan(&prodExists)
	if err != nil || !prodExists {
		return nil, errors.New("المنتج المحدد غير موجود في هذا المطعم")
	}

	// Verify all ingredients belong to restaurant
	for _, ing := range req.Ingredients {
		var itemExists bool
		err := tx.QueryRow("SELECT EXISTS(SELECT 1 FROM inventory_items WHERE id = $1 AND restaurant_id = $2 AND is_active = true)", ing.InventoryItemID, restaurantID).Scan(&itemExists)
		if err != nil || !itemExists {
			return nil, fmt.Errorf("مكون المخزون %s غير موجود أو غير نشط في هذا المطعم", ing.InventoryItemID)
		}
	}

	// Check if recipe already exists
	var existingRecipeID string
	var currentVersion int
	err = tx.QueryRow("SELECT id, version FROM menu_item_recipes WHERE menu_product_id = $1 AND restaurant_id = $2", productID, restaurantID).Scan(&existingRecipeID, &currentVersion)

	recipeID := existingRecipeID
	if err == sql.ErrNoRows {
		recipeID = fmt.Sprintf("recp_%s", uuid.New().String()[:8])
		queryInsert := `
			INSERT INTO menu_item_recipes (id, restaurant_id, menu_product_id, version, is_active, instructions, created_at, updated_at)
			VALUES ($1, $2, $3, 1, true, NULLIF($4, ''), NOW(), NOW())
		`
		if _, err := tx.Exec(queryInsert, recipeID, restaurantID, productID, strings.TrimSpace(req.Instructions)); err != nil {
			return nil, fmt.Errorf("error creating recipe: %w", err)
		}
	} else if err != nil {
		return nil, err
	} else {
		// Update version and instructions
		queryUpdate := `
			UPDATE menu_item_recipes 
			SET version = version + 1, instructions = NULLIF($1, ''), updated_at = NOW()
			WHERE id = $2
		`
		if _, err := tx.Exec(queryUpdate, strings.TrimSpace(req.Instructions), recipeID); err != nil {
			return nil, fmt.Errorf("error updating recipe: %w", err)
		}
		// Clear old ingredients
		if _, err := tx.Exec("DELETE FROM menu_item_recipe_ingredients WHERE recipe_id = $1", recipeID); err != nil {
			return nil, err
		}
	}

	// Insert ingredients
	queryIng := `
		INSERT INTO menu_item_recipe_ingredients (
			id, recipe_id, inventory_item_id, quantity_required, unit, applicable_option_id
		) VALUES (
			$1, $2, $3, $4, $5, NULLIF($6, '')
		)
	`
	for _, ing := range req.Ingredients {
		ingID := fmt.Sprintf("ring_%s", uuid.New().String()[:8])
		var optID string
		if ing.ApplicableOptionID != nil {
			optID = *ing.ApplicableOptionID
		}
		if _, err := tx.Exec(
			queryIng,
			ingID,
			recipeID,
			ing.InventoryItemID,
			ing.QuantityRequired,
			strings.ToUpper(strings.TrimSpace(ing.Unit)),
			optID,
		); err != nil {
			return nil, fmt.Errorf("error inserting recipe ingredient: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return r.GetRecipeByProductID(restaurantID, productID)
}

// ==========================================
// 6. ALERTS
// ==========================================

func (r *InventoryRepository) EvaluateAndRecordAlert(tx *sql.Tx, restaurantID, itemID string, currentQty, minQty float64) error {
	// 1. If currentQty > minQty and minQty >= 0: Resolve any active alerts for this item
	if currentQty > minQty {
		queryResolve := `
			UPDATE inventory_alerts 
			SET status = 'RESOLVED', resolved_at = NOW()
			WHERE restaurant_id = $1 AND inventory_item_id = $2 AND status IN ('ACTIVE', 'ACKNOWLEDGED')
		`
		_, err := tx.Exec(queryResolve, restaurantID, itemID)
		return err
	}

	// Determine alert type
	var alertType models.AlertType
	var msg string

	if currentQty < 0 {
		alertType = models.AlertNegativeStock
		msg = fmt.Sprintf("تحذير حرج: رصيد المخزون بالسالب (%.4f) نتيجة تجاوز طلبات سابقة", currentQty)
	} else if currentQty == 0 {
		alertType = models.AlertOutOfStock
		msg = "تنبيه: نفاد المخزون تماماً (0) لهذا الصنف"
	} else {
		alertType = models.AlertLowStock
		msg = fmt.Sprintf("تنبيه: المخزون منخفض (%.4f) ووصل إلى حد الطلب الأدنى (%.4f)", currentQty, minQty)
	}

	// Upsert active alert: insert if not exists, or update current quantity if already active
	alertID := fmt.Sprintf("alt_%s", uuid.New().String()[:8])
	queryAlert := `
		INSERT INTO inventory_alerts (
			id, restaurant_id, inventory_item_id, alert_type, status,
			threshold_quantity, current_quantity, message, created_at
		) VALUES (
			$1, $2, $3, $4, 'ACTIVE', $5, $6, $7, NOW()
		)
		ON CONFLICT (restaurant_id, inventory_item_id, alert_type) WHERE status IN ('ACTIVE', 'ACKNOWLEDGED')
		DO UPDATE SET current_quantity = EXCLUDED.current_quantity, message = EXCLUDED.message
	`
	_, err := tx.Exec(queryAlert, alertID, restaurantID, itemID, alertType, minQty, currentQty, msg)
	return err
}

func (r *InventoryRepository) ListAlerts(restaurantID string, query models.InventoryAlertFilterQuery) ([]models.InventoryAlert, int, error) {
	baseQuery := `
		FROM inventory_alerts a
		JOIN inventory_items i ON a.inventory_item_id = i.id
		WHERE a.restaurant_id = $1
	`
	args := []interface{}{restaurantID}
	argIdx := 2

	if query.Status != "" && query.Status != "ALL" {
		baseQuery += fmt.Sprintf(" AND a.status = $%d", argIdx)
		args = append(args, query.Status)
		argIdx++
	} else if query.Status == "" {
		// Default to active and acknowledged
		baseQuery += " AND a.status IN ('ACTIVE', 'ACKNOWLEDGED')"
	}

	if query.AlertType != "" && query.AlertType != "ALL" {
		baseQuery += fmt.Sprintf(" AND a.alert_type = $%d", argIdx)
		args = append(args, query.AlertType)
		argIdx++
	}

	var total int
	countQuery := "SELECT COUNT(*) " + baseQuery
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("error counting alerts: %w", err)
	}

	page := query.Page
	if page < 1 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	selectQuery := `
		SELECT 
			a.id, a.restaurant_id, a.inventory_item_id, i.name, i.base_unit,
			a.alert_type, a.status, a.threshold_quantity, a.current_quantity,
			a.message, a.created_at, a.acknowledged_at, COALESCE(a.acknowledged_by, ''),
			a.resolved_at
	` + baseQuery + fmt.Sprintf(" ORDER BY a.created_at DESC LIMIT %d OFFSET %d", pageSize, offset)

	rows, err := r.db.Query(selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("error querying alerts: %w", err)
	}
	defer rows.Close()

	var alerts []models.InventoryAlert
	for rows.Next() {
		var alt models.InventoryAlert
		var createdAt time.Time
		var ackAt, resAt sql.NullTime
		var ackBy sql.NullString
		if err := rows.Scan(
			&alt.ID,
			&alt.RestaurantID,
			&alt.InventoryItemID,
			&alt.ItemName,
			&alt.BaseUnit,
			&alt.AlertType,
			&alt.Status,
			&alt.ThresholdQuantity,
			&alt.CurrentQuantity,
			&alt.Message,
			&createdAt,
			&ackAt,
			&ackBy,
			&resAt,
		); err != nil {
			return nil, 0, err
		}
		alt.CreatedAt = createdAt.Format(time.RFC3339)
		if ackAt.Valid {
			s := ackAt.Time.Format(time.RFC3339)
			alt.AcknowledgedAt = &s
		}
		if ackBy.Valid {
			alt.AcknowledgedBy = &ackBy.String
		}
		if resAt.Valid {
			s := resAt.Time.Format(time.RFC3339)
			alt.ResolvedAt = &s
		}
		alerts = append(alerts, alt)
	}
	if alerts == nil {
		alerts = []models.InventoryAlert{}
	}

	return alerts, total, nil
}

func (r *InventoryRepository) UpdateAlertStatus(restaurantID, alertID, status, actorID string) error {
	var query string
	if status == "ACKNOWLEDGED" {
		query = `
			UPDATE inventory_alerts
			SET status = 'ACKNOWLEDGED', acknowledged_at = NOW(), acknowledged_by = $1
			WHERE id = $2 AND restaurant_id = $3
		`
		res, err := r.db.Exec(query, actorID, alertID, restaurantID)
		if err != nil {
			return err
		}
		rows, _ := res.RowsAffected()
		if rows == 0 {
			return errors.New("التنبيه غير موجود")
		}
		return nil
	}

	if status == "RESOLVED" {
		query = `
			UPDATE inventory_alerts
			SET status = 'RESOLVED', resolved_at = NOW()
			WHERE id = $1 AND restaurant_id = $2
		`
		res, err := r.db.Exec(query, alertID, restaurantID)
		if err != nil {
			return err
		}
		rows, _ := res.RowsAffected()
		if rows == 0 {
			return errors.New("التنبيه غير موجود")
		}
		return nil
	}

	return fmt.Errorf("حالة التنبيه غير صحيحة: %s", status)
}

// ==========================================
// 7. SUMMARY & VALUATION
// ==========================================

func (r *InventoryRepository) GetInventorySummary(restaurantID string) (*models.InventorySummaryResponse, error) {
	resp := &models.InventorySummaryResponse{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
	}

	query := `
		SELECT 
			COUNT(*),
			COALESCE(COUNT(*) FILTER (WHERE b.quantity_on_hand <= i.minimum_stock_quantity AND b.quantity_on_hand > 0), 0),
			COALESCE(COUNT(*) FILTER (WHERE b.quantity_on_hand = 0), 0),
			COALESCE(COUNT(*) FILTER (WHERE b.quantity_on_hand < 0), 0),
			COALESCE(SUM(CASE WHEN b.quantity_on_hand > 0 THEN b.quantity_on_hand * i.cost_per_base_unit ELSE 0 END), 0)
		FROM inventory_items i
		LEFT JOIN inventory_balances b ON i.id = b.inventory_item_id
		WHERE i.restaurant_id = $1 AND i.is_active = true
	`
	err := r.db.QueryRow(query, restaurantID).Scan(
		&resp.TotalItems,
		&resp.LowStockItems,
		&resp.OutOfStockItems,
		&resp.NegativeStockItems,
		&resp.TotalValuation,
	)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("error querying inventory summary: %w", err)
	}

	// Active alerts count
	_ = r.db.QueryRow(`
		SELECT COUNT(*) FROM inventory_alerts
		WHERE restaurant_id = $1 AND status IN ('ACTIVE', 'ACKNOWLEDGED')
	`, restaurantID).Scan(&resp.ActiveAlertsCount)

	// Recent 5 movements
	recentMovs, _, err := r.ListMovements(restaurantID, models.InventoryMovementFilterQuery{
		Page:     1,
		PageSize: 5,
	})
	if err == nil {
		resp.RecentMovements = recentMovs
	} else {
		resp.RecentMovements = []models.InventoryMovement{}
	}

	return resp, nil
}

// ==========================================
// 8. ORDER INVENTORY CONSUMPTION & DEDUCTION
// ==========================================

func (r *InventoryRepository) DeductStockForOrderTx(
	tx *sql.Tx,
	order *models.Order,
	actorID, actorName, actorRole string,
	allowOverride bool,
	overrideReason string,
) ([]models.StockShortage, error) {
	if tx == nil {
		return nil, errors.New("active transaction is required for order inventory deduction")
	}

	// 1. Idempotency check: don't deduct if already deducted for this order
	var existingMovementsCount int
	checkQuery := `
		SELECT COUNT(1) FROM inventory_movements
		WHERE restaurant_id = $1 AND source_type = 'ORDER' AND source_id = $2
	`
	if err := tx.QueryRow(checkQuery, order.RestaurantID, order.ID).Scan(&existingMovementsCount); err != nil {
		return nil, fmt.Errorf("error checking existing inventory movements: %w", err)
	}
	if existingMovementsCount > 0 {
		return nil, nil // Idempotent: already deducted
	}

	// 2. Aggregate required quantities across order items based on active recipes
	type neededItem struct {
		Quantity float64
	}
	neededMap := make(map[string]*neededItem)

	for _, item := range order.Items {
		// Fetch active recipe for this menu item
		var recipeID string
		var isActive bool
		err := tx.QueryRow(`
			SELECT id, is_active FROM menu_item_recipes
			WHERE menu_product_id = $1 AND restaurant_id = $2
		`, item.ProductID, order.RestaurantID).Scan(&recipeID, &isActive)
		if err != nil {
			if err == sql.ErrNoRows {
				continue // No recipe configured for this item
			}
			return nil, fmt.Errorf("error querying recipe for product %s: %w", item.ProductID, err)
		}

		if !isActive {
			continue
		}

		// Fetch recipe ingredients
		ingRows, err := tx.Query(`
			SELECT inventory_item_id, quantity_required, applicable_option_id
			FROM menu_item_recipe_ingredients
			WHERE recipe_id = $1
		`, recipeID)
		if err != nil {
			return nil, fmt.Errorf("error querying recipe ingredients: %w", err)
		}

		for ingRows.Next() {
			var invItemID string
			var qtyReq float64
			var appOptID sql.NullString
			if err := ingRows.Scan(&invItemID, &qtyReq, &appOptID); err != nil {
				ingRows.Close()
				return nil, err
			}

			// If linked to an option, verify option was selected in this order item
			if appOptID.Valid && strings.TrimSpace(appOptID.String) != "" {
				matched := false
				for _, selOpt := range item.SelectedOptions {
					if selOpt.OptionID == appOptID.String {
						matched = true
						break
					}
				}
				if !matched {
					continue
				}
			}

			totalRequired := qtyReq * float64(item.Quantity)
			if entry, exists := neededMap[invItemID]; exists {
				entry.Quantity += totalRequired
			} else {
				neededMap[invItemID] = &neededItem{Quantity: totalRequired}
			}
		}
		ingRows.Close()
	}

	// If no recipe ingredients are tracked for this order, return immediately
	if len(neededMap) == 0 {
		return nil, nil
	}

	// 3. Lock balances FOR UPDATE and check for shortages
	var shortages []models.StockShortage
	type itemStockDetails struct {
		ItemID      string
		ItemName    string
		BaseUnit    string
		CostPerUnit float64
		MinStock    float64
		CurrentQty  float64
		RequiredQty float64
	}
	details := make([]itemStockDetails, 0, len(neededMap))

	for itemID, needed := range neededMap {
		var currentQty float64
		var itemName, baseUnit string
		var costPerUnit, minStock float64

		lockQuery := `
			SELECT b.quantity_on_hand, i.name, i.base_unit, i.cost_per_base_unit, i.minimum_stock_quantity
			FROM inventory_balances b
			JOIN inventory_items i ON b.inventory_item_id = i.id
			WHERE b.inventory_item_id = $1 AND b.restaurant_id = $2
			FOR UPDATE
		`
		err := tx.QueryRow(lockQuery, itemID, order.RestaurantID).Scan(
			&currentQty,
			&itemName,
			&baseUnit,
			&costPerUnit,
			&minStock,
		)
		if err != nil {
			if err == sql.ErrNoRows {
				return nil, fmt.Errorf("عنصر المخزون %s غير موجود أو غير مرتبط بهذا المطعم", itemID)
			}
			return nil, fmt.Errorf("error locking inventory balance for %s: %w", itemID, err)
		}

		if currentQty < needed.Quantity {
			shortages = append(shortages, models.StockShortage{
				ItemID:    itemID,
				ItemName:  itemName,
				Required:  needed.Quantity,
				Available: currentQty,
				Shortage:  math.Round((needed.Quantity-currentQty)*1000) / 1000,
				Unit:      baseUnit,
			})
		}

		details = append(details, itemStockDetails{
			ItemID:      itemID,
			ItemName:    itemName,
			BaseUnit:    baseUnit,
			CostPerUnit: costPerUnit,
			MinStock:    minStock,
			CurrentQty:  currentQty,
			RequiredQty: needed.Quantity,
		})
	}

	// 4. Evaluate Low Stock Policy
	if len(shortages) > 0 {
		if !allowOverride {
			return shortages, errors.New("کمية المخزون غير كافية لتحضير هذا الطلب")
		}

		// Verify actor role has permission to override
		normalizedRole := strings.ToUpper(strings.TrimSpace(actorRole))
		if normalizedRole != "ADMIN" && normalizedRole != "OWNER" && normalizedRole != "MANAGER" && normalizedRole != "SUPER_ADMIN" {
			return nil, fmt.Errorf("ليس لديك صلاحية تجاوز نقص المخزون (الدور: %s)", actorRole)
		}

		if strings.TrimSpace(overrideReason) == "" {
			overrideReason = "تم تجاوز نقص المخزون بموافقة الإدارة"
		}
	}

	// 5. Apply inventory deduction, log movements, and evaluate alerts
	for _, item := range details {
		newBalance := item.CurrentQty - item.RequiredQty
		movementID := fmt.Sprintf("mov_%s", uuid.New().String()[:8])
		reasonText := fmt.Sprintf("خصم تلقائي لبدء تحضير الطلب %s", order.OrderNumber)
		if len(shortages) > 0 {
			reasonText += fmt.Sprintf(" [تجاوز نقص المخزون: %s]", overrideReason)
		}

		movement := &models.InventoryMovement{
			ID:              movementID,
			RestaurantID:    order.RestaurantID,
			InventoryItemID: item.ItemID,
			MovementType:    models.MovementOrderConsumption,
			QuantityDelta:   -item.RequiredQty,
			BalanceBefore:   item.CurrentQty,
			BalanceAfter:    newBalance,
			UnitCost:        item.CostPerUnit,
			TotalCost:       item.RequiredQty * item.CostPerUnit,
			SourceType:      "ORDER",
			SourceID:        order.ID,
			Reason:          reasonText,
			ActorUserID:     actorID,
			ActorName:       actorName,
		}

		if err := r.RecordMovement(tx, movement); err != nil {
			return nil, fmt.Errorf("error recording movement for %s: %w", item.ItemID, err)
		}
	}

	return nil, nil
}
