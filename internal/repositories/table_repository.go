package repositories

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"smart-restaurant-api/internal/database"
	"smart-restaurant-api/internal/models"
)

type TableRepository struct {
	db *database.DB
}

func NewTableRepository(db *database.DB) *TableRepository {
	return &TableRepository{db: db}
}

func (r *TableRepository) BeginTx() (*sql.Tx, error) {
	return r.db.Begin()
}

func (r *TableRepository) ListTables(restaurantID, branchID string, filter models.TableFilterQuery) ([]models.RestaurantTable, int, error) {
	baseQuery := `
		FROM dining_tables t
		LEFT JOIN table_sections s ON t.section_id = s.id
		WHERE t.restaurant_id = $1
	`
	args := []interface{}{restaurantID}
	argIdx := 2

	if branchID != "" {
		baseQuery += fmt.Sprintf(" AND (t.branch_id = $%d OR t.branch_id IS NULL)", argIdx)
		args = append(args, branchID)
		argIdx++
	}

	if filter.Status != "" {
		baseQuery += fmt.Sprintf(" AND t.status = $%d", argIdx)
		args = append(args, filter.Status)
		argIdx++
	}

	if filter.SectionID != "" {
		baseQuery += fmt.Sprintf(" AND t.section_id = $%d", argIdx)
		args = append(args, filter.SectionID)
		argIdx++
	}

	if filter.Search != "" {
		trimmed := strings.ToLower(strings.TrimSpace(filter.Search))
		baseQuery += fmt.Sprintf(" AND (LOWER(t.table_number) LIKE $%d OR LOWER(t.display_name) LIKE $%d OR LOWER(t.name) LIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, "%"+trimmed+"%")
		argIdx++
	}

	// Count total
	countQuery := "SELECT COUNT(*) " + baseQuery
	var total int
	err := r.db.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("error counting tables: %w", err)
	}

	// Pagination
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize

	selectQuery := `
		SELECT t.id, t.restaurant_id, COALESCE(t.branch_id, ''), t.table_number,
		       COALESCE(t.display_name, t.name), t.name, t.capacity,
		       t.section_id, COALESCE(s.name, ''), t.token, t.status, t.is_active,
		       t.created_at, t.updated_at
	` + baseQuery + fmt.Sprintf(" ORDER BY s.display_order ASC NULLS LAST, t.table_number ASC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, pageSize, offset)

	rows, err := r.db.Query(selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("error querying tables: %w", err)
	}
	defer rows.Close()

	var tables []models.RestaurantTable
	for rows.Next() {
		var t models.RestaurantTable
		var sectionID sql.NullString
		err := rows.Scan(
			&t.ID,
			&t.RestaurantID,
			&t.BranchID,
			&t.TableNumber,
			&t.DisplayName,
			&t.Name,
			&t.Capacity,
			&sectionID,
			&t.SectionName,
			&t.Token,
			&t.Status,
			&t.IsActive,
			&t.CreatedAt,
			&t.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		if sectionID.Valid {
			secStr := sectionID.String
			t.SectionID = &secStr
		}
		tables = append(tables, t)
	}

	// Enrich each table with current active session and active order summaries
	for i := range tables {
		sessionSummary, err := r.GetOpenSessionSummary(tables[i].ID)
		if err == nil {
			tables[i].CurrentSession = sessionSummary
		}

		activeOrderSummary, err := r.GetActiveOrderSummary(tables[i].ID)
		if err == nil {
			tables[i].ActiveOrder = activeOrderSummary
		}
	}

	if tables == nil {
		tables = []models.RestaurantTable{}
	}
	return tables, total, nil
}

func (r *TableRepository) GetTableByID(restaurantID, tableID string) (*models.RestaurantTable, error) {
	query := `
		SELECT t.id, t.restaurant_id, COALESCE(t.branch_id, ''), t.table_number,
		       COALESCE(t.display_name, t.name), t.name, t.capacity,
		       t.section_id, COALESCE(s.name, ''), t.token, t.status, t.is_active,
		       t.created_at, t.updated_at
		FROM dining_tables t
		LEFT JOIN table_sections s ON t.section_id = s.id
		WHERE t.id = $1 AND ($2 = '' OR t.restaurant_id = $2)
	`
	row := r.db.QueryRow(query, tableID, restaurantID)

	var t models.RestaurantTable
	var sectionID sql.NullString
	err := row.Scan(
		&t.ID,
		&t.RestaurantID,
		&t.BranchID,
		&t.TableNumber,
		&t.DisplayName,
		&t.Name,
		&t.Capacity,
		&sectionID,
		&t.SectionName,
		&t.Token,
		&t.Status,
		&t.IsActive,
		&t.CreatedAt,
		&t.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying table %s: %w", tableID, err)
	}
	if sectionID.Valid {
		secStr := sectionID.String
		t.SectionID = &secStr
	}

	sessionSummary, _ := r.GetOpenSessionSummary(t.ID)
	t.CurrentSession = sessionSummary

	activeOrderSummary, _ := r.GetActiveOrderSummary(t.ID)
	t.ActiveOrder = activeOrderSummary

	return &t, nil
}

func (r *TableRepository) GetTableByNumber(restaurantID, tableNumber string) (*models.RestaurantTable, error) {
	query := `
		SELECT t.id, t.restaurant_id, COALESCE(t.branch_id, ''), t.table_number,
		       COALESCE(t.display_name, t.name), t.name, t.capacity,
		       t.section_id, COALESCE(s.name, ''), t.token, t.status, t.is_active,
		       t.created_at, t.updated_at
		FROM dining_tables t
		LEFT JOIN table_sections s ON t.section_id = s.id
		WHERE t.restaurant_id = $1 AND LOWER(TRIM(t.table_number)) = LOWER(TRIM($2))
	`
	row := r.db.QueryRow(query, restaurantID, strings.TrimSpace(tableNumber))

	var t models.RestaurantTable
	var sectionID sql.NullString
	err := row.Scan(
		&t.ID,
		&t.RestaurantID,
		&t.BranchID,
		&t.TableNumber,
		&t.DisplayName,
		&t.Name,
		&t.Capacity,
		&sectionID,
		&t.SectionName,
		&t.Token,
		&t.Status,
		&t.IsActive,
		&t.CreatedAt,
		&t.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if sectionID.Valid {
		secStr := sectionID.String
		t.SectionID = &secStr
	}

	sessionSummary, _ := r.GetOpenSessionSummary(t.ID)
	t.CurrentSession = sessionSummary

	activeOrderSummary, _ := r.GetActiveOrderSummary(t.ID)
	t.ActiveOrder = activeOrderSummary

	return &t, nil
}

func (r *TableRepository) GetTableByTokenGlobal(token string) (*models.RestaurantTable, error) {
	query := `
		SELECT t.id, t.restaurant_id, COALESCE(t.branch_id, ''), t.table_number,
		       COALESCE(t.display_name, t.name), t.name, t.capacity,
		       t.section_id, COALESCE(s.name, ''), t.token, t.status, t.is_active,
		       t.created_at, t.updated_at
		FROM dining_tables t
		LEFT JOIN table_sections s ON t.section_id = s.id
		WHERE t.token = $1
	`
	row := r.db.QueryRow(query, strings.TrimSpace(token))

	var t models.RestaurantTable
	var sectionID sql.NullString
	err := row.Scan(
		&t.ID,
		&t.RestaurantID,
		&t.BranchID,
		&t.TableNumber,
		&t.DisplayName,
		&t.Name,
		&t.Capacity,
		&sectionID,
		&t.SectionName,
		&t.Token,
		&t.Status,
		&t.IsActive,
		&t.CreatedAt,
		&t.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying table by token: %w", err)
	}
	if sectionID.Valid {
		secStr := sectionID.String
		t.SectionID = &secStr
	}

	sessionSummary, _ := r.GetOpenSessionSummary(t.ID)
	t.CurrentSession = sessionSummary

	activeOrderSummary, _ := r.GetActiveOrderSummary(t.ID)
	t.ActiveOrder = activeOrderSummary

	return &t, nil
}

func (r *TableRepository) RegenerateTableToken(tableID, newToken string) error {
	query := `
		UPDATE dining_tables
		SET token = $1, updated_at = NOW()
		WHERE id = $2
	`
	res, err := r.db.Exec(query, newToken, tableID)
	if err != nil {
		return fmt.Errorf("failed to update table token: %w", err)
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("table not found")
	}
	return nil
}

func (r *TableRepository) CreateTable(table *models.RestaurantTable) error {
	query := `
		INSERT INTO dining_tables (id, restaurant_id, branch_id, table_number, display_name, name, capacity, section_id, token, status, created_at, updated_at)
		VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
	`
	_, err := r.db.Exec(
		query,
		table.ID,
		table.RestaurantID,
		table.BranchID,
		table.TableNumber,
		table.DisplayName,
		table.DisplayName, // backward compatible name
		table.Capacity,
		table.SectionID,
		table.Token,
		table.Status,
	)
	if err != nil {
		return fmt.Errorf("failed to create table: %w", err)
	}
	return nil
}

func (r *TableRepository) UpdateTable(table *models.RestaurantTable) error {
	query := `
		UPDATE dining_tables
		SET display_name = $1, name = $1, capacity = $2, section_id = $3, status = $4, is_active = $5, updated_at = NOW()
		WHERE id = $6 AND restaurant_id = $7
	`
	res, err := r.db.Exec(
		query,
		table.DisplayName,
		table.Capacity,
		table.SectionID,
		table.Status,
		table.IsActive,
		table.ID,
		table.RestaurantID,
	)
	if err != nil {
		return fmt.Errorf("failed to update table: %w", err)
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("table not found")
	}
	return nil
}

func (r *TableRepository) UpdateTableStatus(tx *sql.Tx, tableID string, status models.TableStatus) error {
	query := `
		UPDATE dining_tables
		SET status = $1, updated_at = NOW()
		WHERE id = $2
	`
	var err error
	if tx != nil {
		_, err = tx.Exec(query, status, tableID)
	} else {
		_, err = r.db.Exec(query, status, tableID)
	}
	return err
}

func (r *TableRepository) GetOpenSessionForTable(tx *sql.Tx, tableID string) (*models.TableSession, error) {
	query := `
		SELECT s.id, s.restaurant_id, COALESCE(s.branch_id, ''), s.table_id,
		       COALESCE(s.opened_by, ''), COALESCE(u.name, ''), s.opened_at, s.closed_at,
		       s.status, COALESCE(s.notes, ''), COALESCE(s.closed_by, ''), COALESCE(cu.name, '')
		FROM table_sessions s
		LEFT JOIN staff_users u ON s.opened_by = u.id
		LEFT JOIN staff_users cu ON s.closed_by = cu.id
		WHERE s.table_id = $1 AND s.status = 'OPEN'
	`
	if tx != nil {
		query += " FOR UPDATE OF s"
	}

	var row *sql.Row
	if tx != nil {
		row = tx.QueryRow(query, tableID)
	} else {
		row = r.db.QueryRow(query, tableID)
	}

	var s models.TableSession
	var closedAt sql.NullTime
	err := row.Scan(
		&s.ID,
		&s.RestaurantID,
		&s.BranchID,
		&s.TableID,
		&s.OpenedBy,
		&s.OpenedByName,
		&s.OpenedAt,
		&closedAt,
		&s.Status,
		&s.Notes,
		&s.ClosedBy,
		&s.ClosedByName,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying open session: %w", err)
	}
	if closedAt.Valid {
		s.ClosedAt = &closedAt.Time
	}
	s.DurationMinutes = int(time.Since(s.OpenedAt).Minutes())
	return &s, nil
}

func (r *TableRepository) GetOrCreateOpenSessionTx(tx *sql.Tx, restaurantID, branchID, tableID string) (*models.TableSession, bool, error) {
	// First check if an open session already exists with row-level lock
	query := `
		SELECT s.id, s.restaurant_id, COALESCE(s.branch_id, ''), s.table_id,
		       COALESCE(s.opened_by, ''), COALESCE(u.name, ''), s.opened_at, s.closed_at,
		       s.status, COALESCE(s.notes, ''), COALESCE(s.closed_by, ''), COALESCE(cu.name, '')
		FROM table_sessions s
		LEFT JOIN staff_users u ON s.opened_by = u.id
		LEFT JOIN staff_users cu ON s.closed_by = cu.id
		WHERE s.table_id = $1 AND s.status = 'OPEN'
		FOR UPDATE OF s
	`
	var s models.TableSession
	var closedAt sql.NullTime
	err := tx.QueryRow(query, tableID).Scan(
		&s.ID,
		&s.RestaurantID,
		&s.BranchID,
		&s.TableID,
		&s.OpenedBy,
		&s.OpenedByName,
		&s.OpenedAt,
		&closedAt,
		&s.Status,
		&s.Notes,
		&s.ClosedBy,
		&s.ClosedByName,
	)
	if err == nil {
		if closedAt.Valid {
			s.ClosedAt = &closedAt.Time
		}
		s.DurationMinutes = int(time.Since(s.OpenedAt).Minutes())
		return &s, false, nil // existing session
	}
	if err != sql.ErrNoRows {
		return nil, false, fmt.Errorf("failed to query open session: %w", err)
	}

	// Create new open session
	newSessionID := fmt.Sprintf("sess_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:6])
	insertQuery := `
		INSERT INTO table_sessions (id, restaurant_id, branch_id, table_id, opened_at, status, notes)
		VALUES ($1, $2, NULLIF($3, ''), $4, NOW(), 'OPEN', 'تم فتح الجلسة تلقائياً عند أول طلب')
		ON CONFLICT (table_id) WHERE status = 'OPEN' DO NOTHING
		RETURNING id, opened_at
	`
	var insertedID string
	var openedAt time.Time
	insertErr := tx.QueryRow(insertQuery, newSessionID, restaurantID, branchID, tableID).Scan(&insertedID, &openedAt)
	if insertErr == nil {
		s = models.TableSession{
			ID:              insertedID,
			RestaurantID:    restaurantID,
			BranchID:        branchID,
			TableID:         tableID,
			OpenedAt:        openedAt,
			Status:          models.SessionStatusOpen,
			Notes:           "تم فتح الجلسة تلقائياً عند أول طلب",
			DurationMinutes: 0,
		}
		return &s, true, nil // newly created session
	}

	// If ON CONFLICT DO NOTHING returned ErrNoRows, a concurrent transaction created it; re-query it with lock
	if insertErr == sql.ErrNoRows {
		err = tx.QueryRow(query, tableID).Scan(
			&s.ID,
			&s.RestaurantID,
			&s.BranchID,
			&s.TableID,
			&s.OpenedBy,
			&s.OpenedByName,
			&s.OpenedAt,
			&closedAt,
			&s.Status,
			&s.Notes,
			&s.ClosedBy,
			&s.ClosedByName,
		)
		if err != nil {
			return nil, false, fmt.Errorf("failed to retrieve concurrent open session: %w", err)
		}
		if closedAt.Valid {
			s.ClosedAt = &closedAt.Time
		}
		s.DurationMinutes = int(time.Since(s.OpenedAt).Minutes())
		return &s, false, nil
	}

	return nil, false, fmt.Errorf("failed to insert table session: %w", insertErr)
}

func (r *TableRepository) GetOpenSessionSummary(tableID string) (*models.TableSessionSummary, error) {
	query := `
		SELECT s.id, COALESCE(s.opened_by, ''), COALESCE(u.name, ''), s.opened_at, s.status, COALESCE(s.notes, ''),
		       COALESCE(s.closed_by, ''), COALESCE(cu.name, ''), s.closed_at,
		       COALESCE((SELECT SUM(o.total) FROM orders o WHERE o.session_id = s.id AND o.status != 'CANCELLED'), 0.0),
		       COALESCE((SELECT COUNT(*) FROM orders o WHERE o.session_id = s.id), 0)
		FROM table_sessions s
		LEFT JOIN staff_users u ON s.opened_by = u.id
		LEFT JOIN staff_users cu ON s.closed_by = cu.id
		WHERE s.table_id = $1 AND s.status = 'OPEN'
		LIMIT 1
	`
	row := r.db.QueryRow(query, tableID)

	var sum models.TableSessionSummary
	var openedAt time.Time
	var closedAt sql.NullTime
	var total float64
	var ordersCount int
	err := row.Scan(
		&sum.ID,
		&sum.OpenedBy,
		&sum.OpenedByName,
		&openedAt,
		&sum.Status,
		&sum.Notes,
		&sum.ClosedBy,
		&sum.ClosedByName,
		&closedAt,
		&total,
		&ordersCount,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	sum.OpenedAt = openedAt.UTC().Format(time.RFC3339)
	if closedAt.Valid {
		str := closedAt.Time.UTC().Format(time.RFC3339)
		sum.ClosedAt = &str
		sum.DurationMinutes = int(closedAt.Time.Sub(openedAt).Minutes())
	} else {
		sum.DurationMinutes = int(time.Since(openedAt).Minutes())
	}
	sum.Total = total
	sum.OrdersCount = ordersCount
	return &sum, nil
}

func (r *TableRepository) GetActiveOrderSummary(tableID string) (*models.ActiveOrderSummary, error) {
	query := `
		SELECT o.id, o.order_number, o.status, o.total, o.created_at,
		       COALESCE((SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id), 0)
		FROM orders o
		WHERE o.table_id = $1 AND o.status IN ('NEW', 'CONFIRMED', 'PREPARING', 'READY')
		ORDER BY o.created_at ASC
		LIMIT 1
	`
	row := r.db.QueryRow(query, tableID)

	var s models.ActiveOrderSummary
	var createdAt time.Time
	err := row.Scan(&s.ID, &s.OrderNumber, &s.Status, &s.Total, &createdAt, &s.ItemsCount)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	s.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return &s, nil
}

func (r *TableRepository) CreateSession(tx *sql.Tx, session *models.TableSession) error {
	query := `
		INSERT INTO table_sessions (id, restaurant_id, branch_id, table_id, opened_by, opened_at, status, notes)
		VALUES ($1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), NOW(), $6, $7)
	`
	var err error
	if tx != nil {
		_, err = tx.Exec(query, session.ID, session.RestaurantID, session.BranchID, session.TableID, session.OpenedBy, session.Status, session.Notes)
	} else {
		_, err = r.db.Exec(query, session.ID, session.RestaurantID, session.BranchID, session.TableID, session.OpenedBy, session.Status, session.Notes)
	}
	if err != nil {
		return fmt.Errorf("failed to insert table session: %w", err)
	}
	return nil
}

func (r *TableRepository) CloseSession(tx *sql.Tx, sessionID, closedBy, notes string) error {
	query := `
		UPDATE table_sessions
		SET status = 'CLOSED', closed_at = NOW(), closed_by = NULLIF($1, ''), notes = CASE WHEN $2 != '' THEN $2 ELSE notes END
		WHERE id = $3 AND status = 'OPEN'
	`
	var res sql.Result
	var err error
	if tx != nil {
		res, err = tx.Exec(query, closedBy, notes, sessionID)
	} else {
		res, err = r.db.Exec(query, closedBy, notes, sessionID)
	}
	if err != nil {
		return fmt.Errorf("failed to close table session: %w", err)
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("open session not found")
	}
	return nil
}

func (r *TableRepository) GetSessionByID(restaurantID, sessionID string) (*models.TableSession, error) {
	query := `
		SELECT s.id, s.restaurant_id, COALESCE(s.branch_id, ''), s.table_id,
		       t.table_number, t.name, t.status,
		       COALESCE(s.opened_by, ''), COALESCE(u.name, ''), s.opened_at, s.closed_at,
		       s.status, COALESCE(s.notes, ''), COALESCE(s.closed_by, ''), COALESCE(cu.name, '')
		FROM table_sessions s
		JOIN dining_tables t ON s.table_id = t.id
		LEFT JOIN staff_users u ON s.opened_by = u.id
		LEFT JOIN staff_users cu ON s.closed_by = cu.id
		WHERE s.id = $1 AND s.restaurant_id = $2
	`
	var s models.TableSession
	var closedAt sql.NullTime
	var tblNum, tblName, tblStatus string
	err := r.db.QueryRow(query, sessionID, restaurantID).Scan(
		&s.ID,
		&s.RestaurantID,
		&s.BranchID,
		&s.TableID,
		&tblNum,
		&tblName,
		&tblStatus,
		&s.OpenedBy,
		&s.OpenedByName,
		&s.OpenedAt,
		&closedAt,
		&s.Status,
		&s.Notes,
		&s.ClosedBy,
		&s.ClosedByName,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying session %s: %w", sessionID, err)
	}
	s.TableNumber = tblNum
	s.TableName = tblName
	s.TableStatus = models.TableStatus(tblStatus)
	if closedAt.Valid {
		s.ClosedAt = &closedAt.Time
		s.DurationMinutes = int(closedAt.Time.Sub(s.OpenedAt).Minutes())
	} else {
		s.DurationMinutes = int(time.Since(s.OpenedAt).Minutes())
	}

	orders, err := r.GetSessionOrders(sessionID)
	if err != nil {
		return nil, err
	}
	s.Orders = orders
	s.OrdersCount = len(orders)

	var total, subtotal, unpaid float64
	allPaid := true
	payableCount := 0
	for _, o := range orders {
		if o.Status != models.StatusCancelled {
			total += o.Total
			subtotal += o.Subtotal
			payableCount++
			if o.PaymentStatus != models.PaymentPaid {
				unpaid += o.Total
				allPaid = false
			}
		}
	}
	s.Total = total
	s.Subtotal = subtotal
	s.UnpaidBalance = unpaid
	if payableCount == 0 {
		s.PaymentStatus = "NO_ORDERS"
	} else if allPaid {
		s.PaymentStatus = string(models.PaymentPaid)
	} else if unpaid < total {
		s.PaymentStatus = "PARTIALLY_PAID"
	} else {
		s.PaymentStatus = string(models.PaymentPending)
	}

	return &s, nil
}

func (r *TableRepository) GetOpenSessionForTableDetails(restaurantID, tableID string) (*models.TableSession, error) {
	query := `
		SELECT s.id
		FROM table_sessions s
		WHERE s.table_id = $1 AND s.restaurant_id = $2 AND s.status = 'OPEN'
		LIMIT 1
	`
	var sessionID string
	err := r.db.QueryRow(query, tableID, restaurantID).Scan(&sessionID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return r.GetSessionByID(restaurantID, sessionID)
}

func (r *TableRepository) GetSessionOrders(sessionID string) ([]models.Order, error) {
	query := `
		SELECT o.id, o.order_number, o.restaurant_id, COALESCE(o.branch_id, ''), o.table_id, o.table_name,
		       o.status, o.subtotal, o.total, o.payment_status, o.created_at, o.updated_at, o.session_id,
		       COALESCE((SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id), 0)
		FROM orders o
		WHERE o.session_id = $1
		ORDER BY o.created_at ASC
	`
	rows, err := r.db.Query(query, sessionID)
	if err != nil {
		return nil, fmt.Errorf("error querying session orders: %w", err)
	}
	defer rows.Close()

	var orders []models.Order
	for rows.Next() {
		var o models.Order
		var createdAt, updatedAt time.Time
		var sessID sql.NullString
		var itemsCount int
		if err := rows.Scan(
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
			&itemsCount,
		); err != nil {
			return nil, err
		}
		o.TableNameSnapshot = o.TableName
		o.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		o.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if sessID.Valid {
			str := sessID.String
			o.SessionID = &str
		}
		if o.Subtotal > o.Total {
			o.Discount = o.Subtotal - o.Total
		}
		orders = append(orders, o)
	}
	if orders == nil {
		orders = []models.Order{}
	}
	return orders, nil
}

func (r *TableRepository) LinkOrdersToSession(tx *sql.Tx, tableID, sessionID string) error {
	query := `
		UPDATE orders
		SET session_id = $1
		WHERE table_id = $2 AND status IN ('NEW', 'CONFIRMED', 'PREPARING', 'READY') AND session_id IS NULL
	`
	var err error
	if tx != nil {
		_, err = tx.Exec(query, sessionID, tableID)
	} else {
		_, err = r.db.Exec(query, sessionID, tableID)
	}
	return err
}

func (r *TableRepository) GetActiveOrdersForTable(tableID string) ([]models.Order, error) {
	query := `
		SELECT id, order_number, restaurant_id, COALESCE(branch_id, ''), table_id, table_name,
		       status, subtotal, total, payment_status, created_at, updated_at, session_id
		FROM orders
		WHERE table_id = $1 AND status IN ('NEW', 'CONFIRMED', 'PREPARING', 'READY')
		ORDER BY created_at ASC
	`
	rows, err := r.db.Query(query, tableID)
	if err != nil {
		return nil, fmt.Errorf("error querying active orders: %w", err)
	}
	defer rows.Close()

	var orders []models.Order
	for rows.Next() {
		var o models.Order
		var createdAt, updatedAt time.Time
		var sessionID sql.NullString
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
		)
		if err != nil {
			return nil, err
		}
		o.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		o.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if sessionID.Valid {
			str := sessionID.String
			o.SessionID = &str
		}
		orders = append(orders, o)
	}
	return orders, nil
}

func (r *TableRepository) ListSections(restaurantID string) ([]models.TableSection, error) {
	query := `
		SELECT id, restaurant_id, COALESCE(branch_id, ''), name, display_order, created_at
		FROM table_sections
		WHERE restaurant_id = $1
		ORDER BY display_order ASC
	`
	rows, err := r.db.Query(query, restaurantID)
	if err != nil {
		return nil, fmt.Errorf("error querying sections: %w", err)
	}
	defer rows.Close()

	var sections []models.TableSection
	for rows.Next() {
		var s models.TableSection
		if err := rows.Scan(&s.ID, &s.RestaurantID, &s.BranchID, &s.Name, &s.DisplayOrder, &s.CreatedAt); err != nil {
			return nil, err
		}
		sections = append(sections, s)
	}
	if sections == nil {
		sections = []models.TableSection{}
	}
	return sections, nil
}

func (r *TableRepository) CreateSection(section *models.TableSection) error {
	query := `
		INSERT INTO table_sections (id, restaurant_id, branch_id, name, display_order, created_at)
		VALUES ($1, $2, NULLIF($3, ''), $4, $5, NOW())
	`
	_, err := r.db.Exec(query, section.ID, section.RestaurantID, section.BranchID, section.Name, section.DisplayOrder)
	return err
}

func (r *TableRepository) ToggleTableActive(restaurantID, tableID string, isActive bool) error {
	query := `UPDATE dining_tables SET is_active = $1, updated_at = NOW() WHERE id = $2 AND restaurant_id = $3`
	res, err := r.db.Exec(query, isActive, tableID, restaurantID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *TableRepository) DeleteTable(restaurantID, tableID string) error {
	// First check if open sessions exist
	var openSessions int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM table_sessions WHERE table_id = $1 AND status = 'OPEN'`, tableID).Scan(&openSessions)
	if err == nil && openSessions > 0 {
		return fmt.Errorf("لا يمكن حذف الطاولة أثناء وجود جلسة مفتوحة")
	}

	// Check if active orders exist
	var activeOrders int
	err = r.db.QueryRow(`SELECT COUNT(*) FROM orders WHERE table_id = $1 AND status IN ('NEW', 'CONFIRMED', 'PREPARING', 'READY')`, tableID).Scan(&activeOrders)
	if err == nil && activeOrders > 0 {
		return fmt.Errorf("لا يمكن حذف الطاولة أثناء وجود طلبات نشطة")
	}

	// Check if historical orders exist
	var orderCount int
	err = r.db.QueryRow(`SELECT COUNT(*) FROM orders WHERE table_id = $1`, tableID).Scan(&orderCount)
	if err == nil && orderCount > 0 {
		// Soft delete to preserve order history
		query := `UPDATE dining_tables SET is_active = false, status = 'OUT_OF_SERVICE', updated_at = NOW() WHERE id = $1 AND restaurant_id = $2`
		res, err := r.db.Exec(query, tableID, restaurantID)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if rows == 0 {
			return sql.ErrNoRows
		}
		return nil
	}

	// Hard delete if table was never used in orders
	query := `DELETE FROM dining_tables WHERE id = $1 AND restaurant_id = $2`
	res, err := r.db.Exec(query, tableID, restaurantID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

