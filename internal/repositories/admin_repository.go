package repositories

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"

	"smart-restaurant-api/internal/database"
	"smart-restaurant-api/internal/models"
)

type AdminRepository struct {
	db        *database.DB
	orderRepo *OrderRepository
}

func NewAdminRepository(db *database.DB, orderRepo *OrderRepository) *AdminRepository {
	return &AdminRepository{
		db:        db,
		orderRepo: orderRepo,
	}
}

// ==========================================
// 1. DASHBOARD & ANALYTICS
// ==========================================

func (r *AdminRepository) GetDashboardStats(restaurantID string) (*models.DashboardStatsResponse, error) {
	resp := &models.DashboardStatsResponse{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
	}

	// 1. Today's order count & sales
	var todayOrders int
	var todaySales float64
	err := r.db.QueryRow(`
		SELECT 
			COUNT(*),
			COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total ELSE 0 END), 0)
		FROM orders
		WHERE restaurant_id = $1 AND created_at >= CURRENT_DATE
	`, restaurantID).Scan(&todayOrders, &todaySales)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("error querying today stats: %w", err)
	}
	resp.TodayOrderCount = todayOrders
	resp.TodaySales = todaySales

	// 2. Total sales & count for all time
	var totalOrdersAllTime int
	var totalSales float64
	err = r.db.QueryRow(`
		SELECT 
			COUNT(*),
			COALESCE(SUM(total), 0)
		FROM orders
		WHERE restaurant_id = $1 AND status != 'CANCELLED'
	`, restaurantID).Scan(&totalOrdersAllTime, &totalSales)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("error querying total sales: %w", err)
	}
	resp.TotalSales = totalSales
	if totalOrdersAllTime > 0 {
		resp.AverageOrderValue = totalSales / float64(totalOrdersAllTime)
	}

	// 3. Orders by status
	statusRows, err := r.db.Query(`
		SELECT status, COUNT(*), COALESCE(SUM(total), 0)
		FROM orders
		WHERE restaurant_id = $1
		GROUP BY status
	`, restaurantID)
	if err != nil {
		return nil, fmt.Errorf("error querying orders by status: %w", err)
	}
	defer statusRows.Close()

	resp.OrdersByStatus = []models.StatusCount{}
	for statusRows.Next() {
		var sc models.StatusCount
		if err := statusRows.Scan(&sc.Status, &sc.Count, &sc.Total); err != nil {
			return nil, err
		}
		resp.OrdersByStatus = append(resp.OrdersByStatus, sc)
	}

	// 4. Best sellers (top 5 products by quantity)
	bestRows, err := r.db.Query(`
		SELECT 
			oi.product_id,
			oi.product_name_snapshot,
			COALESCE(SUM(oi.quantity), 0) AS total_qty,
			COALESCE(SUM(oi.line_total), 0) AS total_rev
		FROM order_items oi
		JOIN orders o ON oi.order_id = o.id
		WHERE o.restaurant_id = $1 AND o.status != 'CANCELLED'
		GROUP BY oi.product_id, oi.product_name_snapshot
		ORDER BY total_qty DESC
		LIMIT 5
	`, restaurantID)
	if err != nil {
		return nil, fmt.Errorf("error querying best sellers: %w", err)
	}
	defer bestRows.Close()

	resp.BestSellers = []models.BestSellerItem{}
	for bestRows.Next() {
		var item models.BestSellerItem
		if err := bestRows.Scan(&item.ProductID, &item.ProductName, &item.TotalQuantity, &item.TotalRevenue); err != nil {
			return nil, err
		}
		resp.BestSellers = append(resp.BestSellers, item)
	}

	// 5. Table occupancy statistics
	var totalTbls, availTbls, occTbls, resTbls, cleanTbls, oosTbls int
	err = r.db.QueryRow(`
		SELECT 
			COUNT(*),
			COALESCE(COUNT(*) FILTER (WHERE status = 'AVAILABLE' AND is_active = true), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'OCCUPIED' AND is_active = true), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'RESERVED' AND is_active = true), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'CLEANING' AND is_active = true), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'OUT_OF_SERVICE' OR is_active = false), 0)
		FROM dining_tables
		WHERE restaurant_id = $1
	`, restaurantID).Scan(&totalTbls, &availTbls, &occTbls, &resTbls, &cleanTbls, &oosTbls)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("error querying table occupancy: %w", err)
	}

	occupancyRate := 0.0
	if totalTbls > 0 {
		occupancyRate = (float64(occTbls) / float64(totalTbls)) * 100.0
	}
	resp.TableOccupancy = models.TableOccupancyStats{
		TotalTables:        totalTbls,
		AvailableTables:    availTbls,
		OccupiedTables:     occTbls,
		ReservedTables:     resTbls,
		CleaningTables:     cleanTbls,
		OutOfServiceTables: oosTbls,
		OccupancyRate:      occupancyRate,
	}

	// 6. Recent orders (latest 5)
	recentOrders, _, err := r.ListOrders(restaurantID, models.AdminOrderFilterQuery{
		Page:     1,
		PageSize: 5,
	})
	if err == nil {
		resp.RecentOrders = recentOrders
	} else {
		resp.RecentOrders = []models.Order{}
	}

	return resp, nil
}

func (r *AdminRepository) GetAnalytics(restaurantID string, from, to time.Time) (*models.AnalyticsResponse, error) {
	resp := &models.AnalyticsResponse{
		From:               from.Format(time.RFC3339),
		To:                 to.Format(time.RFC3339),
		SalesTrend:         []models.DailySalesPoint{},
		StatusDistribution: []models.StatusCount{},
		HourlyDistribution: []models.HourlyDistributionPoint{},
		TopCategories:      []models.CategoryRevenuePoint{},
	}

	// 1. Overall totals in range
	var totalRev float64
	var totalOrd, servedOrd, cancelledOrd int
	err := r.db.QueryRow(`
		SELECT 
			COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total ELSE 0 END), 0),
			COUNT(*),
			COALESCE(COUNT(*) FILTER (WHERE status = 'SERVED'), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'CANCELLED'), 0)
		FROM orders
		WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3
	`, restaurantID, from, to).Scan(&totalRev, &totalOrd, &servedOrd, &cancelledOrd)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("error querying analytics totals: %w", err)
	}

	resp.TotalRevenue = totalRev
	resp.TotalOrders = totalOrd
	resp.ServedOrders = servedOrd
	resp.CancelledOrders = cancelledOrd
	nonCancelled := totalOrd - cancelledOrd
	if nonCancelled > 0 {
		resp.AverageOrderValue = totalRev / float64(nonCancelled)
	}

	// 2. Daily sales trend
	trendRows, err := r.db.Query(`
		SELECT 
			TO_CHAR(created_at, 'YYYY-MM-DD') as day,
			COALESCE(SUM(total), 0),
			COUNT(*)
		FROM orders
		WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3 AND status != 'CANCELLED'
		GROUP BY day
		ORDER BY day ASC
	`, restaurantID, from, to)
	if err == nil {
		defer trendRows.Close()
		for trendRows.Next() {
			var pt models.DailySalesPoint
			if err := trendRows.Scan(&pt.Date, &pt.Revenue, &pt.Orders); err == nil {
				resp.SalesTrend = append(resp.SalesTrend, pt)
			}
		}
	}

	// 3. Status distribution
	statusRows, err := r.db.Query(`
		SELECT status, COUNT(*), COALESCE(SUM(total), 0)
		FROM orders
		WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3
		GROUP BY status
	`, restaurantID, from, to)
	if err == nil {
		defer statusRows.Close()
		for statusRows.Next() {
			var sc models.StatusCount
			if err := statusRows.Scan(&sc.Status, &sc.Count, &sc.Total); err == nil {
				resp.StatusDistribution = append(resp.StatusDistribution, sc)
			}
		}
	}

	// 4. Hourly distribution (0 to 23)
	hourRows, err := r.db.Query(`
		SELECT 
			EXTRACT(HOUR FROM created_at)::int as hr,
			COUNT(*)
		FROM orders
		WHERE restaurant_id = $1 AND created_at >= $2 AND created_at <= $3
		GROUP BY hr
		ORDER BY hr ASC
	`, restaurantID, from, to)
	if err == nil {
		defer hourRows.Close()
		for hourRows.Next() {
			var hp models.HourlyDistributionPoint
			if err := hourRows.Scan(&hp.Hour, &hp.Orders); err == nil {
				resp.HourlyDistribution = append(resp.HourlyDistribution, hp)
			}
		}
	}

	// 5. Top categories
	catRows, err := r.db.Query(`
		SELECT 
			mc.id,
			mc.name_ar,
			COALESCE(SUM(oi.line_total), 0) AS rev,
			COALESCE(SUM(oi.quantity), 0) AS qty
		FROM order_items oi
		JOIN menu_products mp ON oi.product_id = mp.id
		JOIN menu_categories mc ON mp.category_id = mc.id
		JOIN orders o ON oi.order_id = o.id
		WHERE o.restaurant_id = $1 AND o.created_at >= $2 AND o.created_at <= $3 AND o.status != 'CANCELLED'
		GROUP BY mc.id, mc.name_ar
		ORDER BY rev DESC
		LIMIT 5
	`, restaurantID, from, to)
	if err == nil {
		defer catRows.Close()
		for catRows.Next() {
			var cp models.CategoryRevenuePoint
			if err := catRows.Scan(&cp.CategoryID, &cp.CategoryName, &cp.Revenue, &cp.ItemsSold); err == nil {
				resp.TopCategories = append(resp.TopCategories, cp)
			}
		}
	}

	return resp, nil
}

// ==========================================
// 2. RESTAURANT SETTINGS
// ==========================================

func (r *AdminRepository) GetRestaurantSettings(restaurantID string) (*models.Restaurant, error) {
	query := `
		SELECT id, name, slug, COALESCE(description, ''), COALESCE(logo_url, ''), currency,
		       is_open, estimated_prep_minutes, COALESCE(phone, ''), COALESCE(address, ''),
		       COALESCE(opening_hours, ''), tax_rate, service_fee_rate, created_at, updated_at
		FROM restaurants
		WHERE id = $1
	`
	row := r.db.QueryRow(query, restaurantID)
	var rest models.Restaurant
	err := row.Scan(
		&rest.ID,
		&rest.Name,
		&rest.Slug,
		&rest.Description,
		&rest.LogoURL,
		&rest.Currency,
		&rest.IsOpen,
		&rest.EstimatedPreparationMinutes,
		&rest.Phone,
		&rest.Address,
		&rest.OpeningHours,
		&rest.TaxRate,
		&rest.ServiceFeeRate,
		&rest.CreatedAt,
		&rest.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying restaurant: %w", err)
	}
	return &rest, nil
}

func (r *AdminRepository) UpdateRestaurantSettings(restaurantID string, req models.UpdateRestaurantSettingsRequest) (*models.Restaurant, error) {
	setClauses := []string{"updated_at = NOW()"}
	args := []interface{}{restaurantID}
	argIdx := 2

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.Name))
		argIdx++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.Description))
		argIdx++
	}
	if req.LogoURL != nil {
		setClauses = append(setClauses, fmt.Sprintf("logo_url = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.LogoURL))
		argIdx++
	}
	if req.Currency != nil {
		setClauses = append(setClauses, fmt.Sprintf("currency = $%d", argIdx))
		args = append(args, strings.ToUpper(strings.TrimSpace(*req.Currency)))
		argIdx++
	}
	if req.IsOpen != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_open = $%d", argIdx))
		args = append(args, *req.IsOpen)
		argIdx++
	}
	if req.EstimatedPreparationMinutes != nil {
		setClauses = append(setClauses, fmt.Sprintf("estimated_prep_minutes = $%d", argIdx))
		args = append(args, *req.EstimatedPreparationMinutes)
		argIdx++
	}
	if req.Phone != nil {
		setClauses = append(setClauses, fmt.Sprintf("phone = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.Phone))
		argIdx++
	}
	if req.Address != nil {
		setClauses = append(setClauses, fmt.Sprintf("address = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.Address))
		argIdx++
	}
	if req.OpeningHours != nil {
		setClauses = append(setClauses, fmt.Sprintf("opening_hours = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.OpeningHours))
		argIdx++
	}
	if req.TaxRate != nil {
		setClauses = append(setClauses, fmt.Sprintf("tax_rate = $%d", argIdx))
		args = append(args, *req.TaxRate)
		argIdx++
	}
	if req.ServiceFeeRate != nil {
		setClauses = append(setClauses, fmt.Sprintf("service_fee_rate = $%d", argIdx))
		args = append(args, *req.ServiceFeeRate)
		argIdx++
	}

	query := fmt.Sprintf("UPDATE restaurants SET %s WHERE id = $1", strings.Join(setClauses, ", "))
	res, err := r.db.Exec(query, args...)
	if err != nil {
		return nil, fmt.Errorf("error updating restaurant settings: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil || rows == 0 {
		return nil, errors.New("لم يتم العثور على المطعم")
	}

	return r.GetRestaurantSettings(restaurantID)
}

// ==========================================
// 3. CATEGORY MANAGEMENT
// ==========================================

func (r *AdminRepository) ListCategories(restaurantID string) ([]models.AdminCategorySummary, error) {
	query := `
		SELECT 
			c.id, c.restaurant_id, c.name_ar, COALESCE(c.name_en, ''),
			c.display_order, c.is_active, COALESCE(c.icon_name, ''),
			COALESCE(COUNT(p.id), 0) AS products_count
		FROM menu_categories c
		LEFT JOIN menu_products p ON c.id = p.category_id
		WHERE c.restaurant_id = $1
		GROUP BY c.id
		ORDER BY c.display_order ASC, c.created_at ASC
	`
	rows, err := r.db.Query(query, restaurantID)
	if err != nil {
		return nil, fmt.Errorf("error querying admin categories: %w", err)
	}
	defer rows.Close()

	var categories []models.AdminCategorySummary
	for rows.Next() {
		var cat models.AdminCategorySummary
		if err := rows.Scan(
			&cat.ID,
			&cat.RestaurantID,
			&cat.NameAr,
			&cat.NameEn,
			&cat.DisplayOrder,
			&cat.IsActive,
			&cat.IconName,
			&cat.ProductsCount,
		); err != nil {
			return nil, err
		}
		categories = append(categories, cat)
	}
	if categories == nil {
		categories = []models.AdminCategorySummary{}
	}
	return categories, nil
}

func (r *AdminRepository) CreateCategory(category *models.MenuCategory) error {
	query := `
		INSERT INTO menu_categories (id, restaurant_id, name_ar, name_en, display_order, is_active, icon_name, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
	`
	_, err := r.db.Exec(
		query,
		category.ID,
		category.RestaurantID,
		category.NameAr,
		category.NameEn,
		category.DisplayOrder,
		category.IsActive,
		category.IconName,
	)
	return err
}

func (r *AdminRepository) GetCategoryByID(restaurantID, categoryID string) (*models.MenuCategory, error) {
	query := `
		SELECT id, restaurant_id, name_ar, COALESCE(name_en, ''), display_order, is_active, COALESCE(icon_name, '')
		FROM menu_categories
		WHERE id = $1 AND restaurant_id = $2
	`
	row := r.db.QueryRow(query, categoryID, restaurantID)
	var cat models.MenuCategory
	err := row.Scan(
		&cat.ID,
		&cat.RestaurantID,
		&cat.NameAr,
		&cat.NameEn,
		&cat.DisplayOrder,
		&cat.IsActive,
		&cat.IconName,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &cat, nil
}

func (r *AdminRepository) UpdateCategory(restaurantID, categoryID string, req models.UpdateCategoryRequest) (*models.MenuCategory, error) {
	setClauses := []string{}
	args := []interface{}{categoryID, restaurantID}
	argIdx := 3

	if req.NameAr != nil {
		setClauses = append(setClauses, fmt.Sprintf("name_ar = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.NameAr))
		argIdx++
	}
	if req.NameEn != nil {
		setClauses = append(setClauses, fmt.Sprintf("name_en = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.NameEn))
		argIdx++
	}
	if req.DisplayOrder != nil {
		setClauses = append(setClauses, fmt.Sprintf("display_order = $%d", argIdx))
		args = append(args, *req.DisplayOrder)
		argIdx++
	}
	if req.IsActive != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *req.IsActive)
		argIdx++
	}
	if req.IconName != nil {
		setClauses = append(setClauses, fmt.Sprintf("icon_name = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.IconName))
		argIdx++
	}

	if len(setClauses) > 0 {
		query := fmt.Sprintf("UPDATE menu_categories SET %s WHERE id = $1 AND restaurant_id = $2", strings.Join(setClauses, ", "))
		res, err := r.db.Exec(query, args...)
		if err != nil {
			return nil, err
		}
		rows, err := res.RowsAffected()
		if err != nil || rows == 0 {
			return nil, errors.New("القسم غير موجود")
		}
	}

	return r.GetCategoryByID(restaurantID, categoryID)
}

func (r *AdminRepository) DeleteCategory(restaurantID, categoryID string) error {
	// Check if products exist in category
	var count int
	err := r.db.QueryRow("SELECT COUNT(*) FROM menu_products WHERE category_id = $1 AND restaurant_id = $2", categoryID, restaurantID).Scan(&count)
	if err == nil && count > 0 {
		return fmt.Errorf("لا يمكن حذف القسم لأنه يحتوي على %d منتج، يرجى نقل أو حذف المنتجات أولاً", count)
	}

	res, err := r.db.Exec("DELETE FROM menu_categories WHERE id = $1 AND restaurant_id = $2", categoryID, restaurantID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil || rows == 0 {
		return errors.New("القسم غير موجود")
	}
	return nil
}

func (r *AdminRepository) ReorderCategories(restaurantID string, items []models.ReorderCategoryItem) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare("UPDATE menu_categories SET display_order = $1 WHERE id = $2 AND restaurant_id = $3")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, item := range items {
		if _, err := stmt.Exec(item.DisplayOrder, item.ID, restaurantID); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// ==========================================
// 4. PRODUCT MANAGEMENT
// ==========================================

func (r *AdminRepository) ListProducts(restaurantID string, query models.ProductFilterQuery) ([]models.Product, int, error) {
	baseQuery := `
		FROM menu_products p
		WHERE p.restaurant_id = $1
	`
	args := []interface{}{restaurantID}
	argIdx := 2

	if query.CategoryID != "" && query.CategoryID != "all" {
		baseQuery += fmt.Sprintf(" AND p.category_id = $%d", argIdx)
		args = append(args, query.CategoryID)
		argIdx++
	}

	if query.IsAvailable != nil {
		baseQuery += fmt.Sprintf(" AND p.is_available = $%d", argIdx)
		args = append(args, *query.IsAvailable)
		argIdx++
	}

	if query.Search != "" {
		trimmed := strings.ToLower(strings.TrimSpace(query.Search))
		baseQuery += fmt.Sprintf(" AND (LOWER(p.name_ar) LIKE $%d OR LOWER(COALESCE(p.name_en, '')) LIKE $%d OR LOWER(COALESCE(p.description, '')) LIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, "%"+trimmed+"%")
		argIdx++
	}

	// Count total
	var total int
	countQuery := "SELECT COUNT(*) " + baseQuery
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("error counting products: %w", err)
	}

	// Pagination
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
			p.id, p.restaurant_id, p.category_id, p.name_ar, COALESCE(p.name_en, ''),
			COALESCE(p.description, ''), p.price, COALESCE(p.image_url, ''),
			p.is_available, p.is_featured, COALESCE(p.badge, '')
	` + baseQuery + fmt.Sprintf(" ORDER BY p.display_order ASC, p.created_at DESC LIMIT %d OFFSET %d", pageSize, offset)

	rows, err := r.db.Query(selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("error querying products: %w", err)
	}
	defer rows.Close()

	var products []models.Product
	for rows.Next() {
		var p models.Product
		if err := rows.Scan(
			&p.ID,
			&p.RestaurantID,
			&p.CategoryID,
			&p.NameAr,
			&p.NameEn,
			&p.Description,
			&p.Price,
			&p.ImageURL,
			&p.IsAvailable,
			&p.IsFeatured,
			&p.Badge,
		); err != nil {
			return nil, 0, err
		}
		products = append(products, p)
	}

	// Load options for products
	for i := range products {
		options, err := r.GetProductOptions(products[i].ID)
		if err == nil {
			products[i].Options = options
		} else {
			products[i].Options = []models.ProductOptionGroup{}
		}
	}

	if products == nil {
		products = []models.Product{}
	}

	return products, total, nil
}

func (r *AdminRepository) GetProductByID(restaurantID, productID string) (*models.Product, error) {
	query := `
		SELECT 
			id, restaurant_id, category_id, name_ar, COALESCE(name_en, ''),
			COALESCE(description, ''), price, COALESCE(image_url, ''),
			is_available, is_featured, COALESCE(badge, '')
		FROM menu_products
		WHERE id = $1 AND restaurant_id = $2
	`
	row := r.db.QueryRow(query, productID, restaurantID)
	var p models.Product
	err := row.Scan(
		&p.ID,
		&p.RestaurantID,
		&p.CategoryID,
		&p.NameAr,
		&p.NameEn,
		&p.Description,
		&p.Price,
		&p.ImageURL,
		&p.IsAvailable,
		&p.IsFeatured,
		&p.Badge,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	options, err := r.GetProductOptions(p.ID)
	if err != nil {
		return nil, err
	}
	p.Options = options

	return &p, nil
}

func (r *AdminRepository) GetProductOptions(productID string) ([]models.ProductOptionGroup, error) {
	groupsQuery := `
		SELECT id, name_ar, selection_type, is_required, min_selections, max_selections
		FROM product_option_groups
		WHERE product_id = $1
		ORDER BY display_order ASC
	`
	rows, err := r.db.Query(groupsQuery, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []models.ProductOptionGroup
	for rows.Next() {
		var g models.ProductOptionGroup
		if err := rows.Scan(&g.ID, &g.NameAr, &g.SelectionType, &g.IsRequired, &g.MinSelections, &g.MaxSelections); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}

	for i := range groups {
		optionsQuery := `
			SELECT id, name_ar, price_delta, is_available
			FROM product_options
			WHERE group_id = $1
			ORDER BY display_order ASC
		`
		optRows, err := r.db.Query(optionsQuery, groups[i].ID)
		if err != nil {
			return nil, err
		}
		var opts []models.ProductOption
		for optRows.Next() {
			var opt models.ProductOption
			if err := optRows.Scan(&opt.ID, &opt.NameAr, &opt.PriceDelta, &opt.IsAvailable); err != nil {
				optRows.Close()
				return nil, err
			}
			opts = append(opts, opt)
		}
		optRows.Close()
		if opts == nil {
			opts = []models.ProductOption{}
		}
		groups[i].Options = opts
	}

	if groups == nil {
		groups = []models.ProductOptionGroup{}
	}
	return groups, nil
}

func (r *AdminRepository) CreateProduct(p *models.Product, options []models.CreateOptionGroupRequest) (*models.Product, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 1. Verify category exists in this restaurant
	var catExists bool
	err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM menu_categories WHERE id = $1 AND restaurant_id = $2)", p.CategoryID, p.RestaurantID).Scan(&catExists)
	if err != nil || !catExists {
		return nil, errors.New("القسم المحدد غير موجود في هذا المطعم")
	}

	// 2. Insert product
	productQuery := `
		INSERT INTO menu_products (
			id, restaurant_id, category_id, name_ar, name_en, description,
			price, image_url, is_available, is_featured, badge, display_order, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
		)
	`
	_, err = tx.Exec(
		productQuery,
		p.ID,
		p.RestaurantID,
		p.CategoryID,
		p.NameAr,
		p.NameEn,
		p.Description,
		p.Price,
		p.ImageURL,
		p.IsAvailable,
		p.IsFeatured,
		p.Badge,
		0,
	)
	if err != nil {
		return nil, fmt.Errorf("error creating product: %w", err)
	}

	// 3. Insert Option Groups and Options
	for gIdx, group := range options {
		groupID := fmt.Sprintf("grp_%s_%d", p.ID, gIdx+1)
		groupQuery := `
			INSERT INTO product_option_groups (
				id, product_id, name_ar, selection_type, is_required, min_selections, max_selections, display_order
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8
			)
		`
		minSel := 0
		if group.MinSelections != nil {
			minSel = *group.MinSelections
		}
		maxSel := 1
		if group.MaxSelections != nil {
			maxSel = *group.MaxSelections
		}
		dispOrder := gIdx + 1
		if group.DisplayOrder > 0 {
			dispOrder = group.DisplayOrder
		}

		_, err = tx.Exec(
			groupQuery,
			groupID,
			p.ID,
			group.NameAr,
			group.SelectionType,
			group.IsRequired,
			minSel,
			maxSel,
			dispOrder,
		)
		if err != nil {
			return nil, fmt.Errorf("error creating option group: %w", err)
		}

		for oIdx, opt := range group.Options {
			optID := fmt.Sprintf("opt_%s_%d", groupID, oIdx+1)
			isAvail := true
			if opt.IsAvailable != nil {
				isAvail = *opt.IsAvailable
			}
			optDispOrder := oIdx + 1
			if opt.DisplayOrder > 0 {
				optDispOrder = opt.DisplayOrder
			}

			optQuery := `
				INSERT INTO product_options (
					id, group_id, name_ar, price_delta, is_available, display_order
				) VALUES (
					$1, $2, $3, $4, $5, $6
				)
			`
			_, err = tx.Exec(
				optQuery,
				optID,
				groupID,
				opt.NameAr,
				opt.PriceDelta,
				isAvail,
				optDispOrder,
			)
			if err != nil {
				return nil, fmt.Errorf("error creating option item: %w", err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return r.GetProductByID(p.RestaurantID, p.ID)
}

func (r *AdminRepository) UpdateProduct(restaurantID, productID string, req models.UpdateProductRequest) (*models.Product, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Check product exists
	var existingCatID string
	err = tx.QueryRow("SELECT category_id FROM menu_products WHERE id = $1 AND restaurant_id = $2", productID, restaurantID).Scan(&existingCatID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("المنتج غير موجود")
		}
		return nil, err
	}

	setClauses := []string{"updated_at = NOW()"}
	args := []interface{}{productID, restaurantID}
	argIdx := 3

	if req.CategoryID != nil {
		// verify category exists
		var catExists bool
		err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM menu_categories WHERE id = $1 AND restaurant_id = $2)", *req.CategoryID, restaurantID).Scan(&catExists)
		if err != nil || !catExists {
			return nil, errors.New("القسم المحدد غير موجود في هذا المطعم")
		}
		setClauses = append(setClauses, fmt.Sprintf("category_id = $%d", argIdx))
		args = append(args, *req.CategoryID)
		argIdx++
	}
	if req.NameAr != nil {
		setClauses = append(setClauses, fmt.Sprintf("name_ar = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.NameAr))
		argIdx++
	}
	if req.NameEn != nil {
		setClauses = append(setClauses, fmt.Sprintf("name_en = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.NameEn))
		argIdx++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.Description))
		argIdx++
	}
	if req.Price != nil {
		setClauses = append(setClauses, fmt.Sprintf("price = $%d", argIdx))
		args = append(args, *req.Price)
		argIdx++
	}
	if req.ImageURL != nil {
		setClauses = append(setClauses, fmt.Sprintf("image_url = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.ImageURL))
		argIdx++
	}
	if req.IsAvailable != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_available = $%d", argIdx))
		args = append(args, *req.IsAvailable)
		argIdx++
	}
	if req.IsFeatured != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_featured = $%d", argIdx))
		args = append(args, *req.IsFeatured)
		argIdx++
	}
	if req.Badge != nil {
		setClauses = append(setClauses, fmt.Sprintf("badge = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.Badge))
		argIdx++
	}
	if req.DisplayOrder != nil {
		setClauses = append(setClauses, fmt.Sprintf("display_order = $%d", argIdx))
		args = append(args, *req.DisplayOrder)
		argIdx++
	}

	if len(setClauses) > 1 {
		updateQuery := fmt.Sprintf("UPDATE menu_products SET %s WHERE id = $1 AND restaurant_id = $2", strings.Join(setClauses, ", "))
		if _, err := tx.Exec(updateQuery, args...); err != nil {
			return nil, fmt.Errorf("error updating product: %w", err)
		}
	}

	// Update options if specified
	if req.Options != nil {
		// Delete existing option groups (cascades to options)
		if _, err := tx.Exec("DELETE FROM product_option_groups WHERE product_id = $1", productID); err != nil {
			return nil, fmt.Errorf("error clearing old option groups: %w", err)
		}

		for gIdx, group := range *req.Options {
			groupID := fmt.Sprintf("grp_%s_%d", productID, gIdx+1)
			minSel := 0
			if group.MinSelections != nil {
				minSel = *group.MinSelections
			}
			maxSel := 1
			if group.MaxSelections != nil {
				maxSel = *group.MaxSelections
			}
			dispOrder := gIdx + 1
			if group.DisplayOrder > 0 {
				dispOrder = group.DisplayOrder
			}

			groupQuery := `
				INSERT INTO product_option_groups (
					id, product_id, name_ar, selection_type, is_required, min_selections, max_selections, display_order
				) VALUES (
					$1, $2, $3, $4, $5, $6, $7, $8
				)
			`
			if _, err := tx.Exec(groupQuery, groupID, productID, group.NameAr, group.SelectionType, group.IsRequired, minSel, maxSel, dispOrder); err != nil {
				return nil, fmt.Errorf("error updating option group: %w", err)
			}

			for oIdx, opt := range group.Options {
				optID := fmt.Sprintf("opt_%s_%d", groupID, oIdx+1)
				isAvail := true
				if opt.IsAvailable != nil {
					isAvail = *opt.IsAvailable
				}
				optDispOrder := oIdx + 1
				if opt.DisplayOrder > 0 {
					optDispOrder = opt.DisplayOrder
				}

				optQuery := `
					INSERT INTO product_options (
						id, group_id, name_ar, price_delta, is_available, display_order
					) VALUES (
						$1, $2, $3, $4, $5, $6
					)
				`
				if _, err := tx.Exec(optQuery, optID, groupID, opt.NameAr, opt.PriceDelta, isAvail, optDispOrder); err != nil {
					return nil, fmt.Errorf("error updating option: %w", err)
				}
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return r.GetProductByID(restaurantID, productID)
}

func (r *AdminRepository) DeleteProduct(restaurantID, productID string) error {
	// Check if product is in active orders
	var activeCount int
	err := r.db.QueryRow(`
		SELECT COUNT(*) 
		FROM order_items oi
		JOIN orders o ON oi.order_id = o.id
		WHERE oi.product_id = $1 AND o.restaurant_id = $2 AND o.status IN ('NEW', 'CONFIRMED', 'PREPARING', 'READY')
	`, productID, restaurantID).Scan(&activeCount)
	if err == nil && activeCount > 0 {
		return fmt.Errorf("لا يمكن حذف المنتج لأنه مرتبط بـ %d طلبات نشطة حالياً", activeCount)
	}

	// Check if product was ever ordered in history
	var historicalCount int
	err = r.db.QueryRow(`
		SELECT COUNT(*) 
		FROM order_items oi
		JOIN orders o ON oi.order_id = o.id
		WHERE oi.product_id = $1 AND o.restaurant_id = $2
	`, productID, restaurantID).Scan(&historicalCount)
	if err == nil && historicalCount > 0 {
		// Soft delete to protect past order historical data
		_, err := r.db.Exec("UPDATE menu_products SET is_available = false, updated_at = NOW() WHERE id = $1 AND restaurant_id = $2", productID, restaurantID)
		return err
	}

	// Hard delete if never ordered
	res, err := r.db.Exec("DELETE FROM menu_products WHERE id = $1 AND restaurant_id = $2", productID, restaurantID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil || rows == 0 {
		return errors.New("المنتج غير موجود")
	}
	return nil
}

func (r *AdminRepository) ToggleProductAvailability(restaurantID, productID string, isAvailable bool) error {
	res, err := r.db.Exec("UPDATE menu_products SET is_available = $1, updated_at = NOW() WHERE id = $2 AND restaurant_id = $3", isAvailable, productID, restaurantID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil || rows == 0 {
		return errors.New("المنتج غير موجود")
	}
	return nil
}

// ==========================================
// 5. ORDERS INTEGRATION & LISTING
// ==========================================

func (r *AdminRepository) ListOrders(restaurantID string, filter models.AdminOrderFilterQuery) ([]models.Order, int, error) {
	baseQuery := `
		FROM orders o
		WHERE o.restaurant_id = $1
	`
	args := []interface{}{restaurantID}
	argIdx := 2

	if filter.Status != "" && filter.Status != "ALL" {
		baseQuery += fmt.Sprintf(" AND o.status = $%d", argIdx)
		args = append(args, filter.Status)
		argIdx++
	}

	if filter.TableID != "" {
		baseQuery += fmt.Sprintf(" AND o.table_id = $%d", argIdx)
		args = append(args, filter.TableID)
		argIdx++
	}

	if filter.OrderType != "" && filter.OrderType != "ALL" {
		baseQuery += fmt.Sprintf(" AND o.order_type = $%d", argIdx)
		args = append(args, filter.OrderType)
		argIdx++
	}

	if filter.From != "" {
		if tFrom, err := time.Parse(time.RFC3339, filter.From); err == nil {
			baseQuery += fmt.Sprintf(" AND o.created_at >= $%d", argIdx)
			args = append(args, tFrom)
			argIdx++
		} else if dFrom, err := time.Parse("2006-01-02", filter.From); err == nil {
			baseQuery += fmt.Sprintf(" AND o.created_at >= $%d", argIdx)
			args = append(args, dFrom)
			argIdx++
		}
	}

	if filter.To != "" {
		if tTo, err := time.Parse(time.RFC3339, filter.To); err == nil {
			baseQuery += fmt.Sprintf(" AND o.created_at <= $%d", argIdx)
			args = append(args, tTo)
			argIdx++
		} else if dTo, err := time.Parse("2006-01-02", filter.To); err == nil {
			baseQuery += fmt.Sprintf(" AND o.created_at <= $%d", argIdx)
			args = append(args, dTo.Add(24*time.Hour))
			argIdx++
		}
	}

	if filter.Search != "" {
		trimmed := strings.ToLower(strings.TrimSpace(filter.Search))
		baseQuery += fmt.Sprintf(" AND (LOWER(o.order_number) LIKE $%d OR LOWER(o.table_name) LIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+trimmed+"%")
		argIdx++
	}

	// Count total
	var total int
	countQuery := "SELECT COUNT(*) " + baseQuery
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("error counting orders: %w", err)
	}

	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 12
	} else if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize

	// Whitelisted sorting
	sortCol := "o.created_at"
	switch strings.ToLower(strings.TrimSpace(filter.Sort)) {
	case "createdat", "created_at":
		sortCol = "o.created_at"
	case "updatedat", "updated_at":
		sortCol = "o.updated_at"
	case "total":
		sortCol = "o.total"
	case "subtotal":
		sortCol = "o.subtotal"
	case "ordernumber", "order_number":
		sortCol = "o.order_number"
	case "ordertype", "order_type":
		sortCol = "o.order_type"
	case "status":
		sortCol = "o.status"
	}

	sortOrder := "DESC"
	if strings.ToLower(strings.TrimSpace(filter.Order)) == "asc" {
		sortOrder = "ASC"
	}

	selectQuery := `
		SELECT 
			o.id, o.order_number, o.restaurant_id, COALESCE(o.branch_id, ''),
			COALESCE(o.table_id, ''), COALESCE(o.table_name, 'طلب سفري'), o.status, o.subtotal, o.total,
			o.payment_status, o.created_at, o.updated_at, o.session_id, COALESCE(o.order_type, 'DINE_IN')
	` + baseQuery + fmt.Sprintf(" ORDER BY %s %s, o.id %s LIMIT %d OFFSET %d", sortCol, sortOrder, sortOrder, pageSize, offset)

	rows, err := r.db.Query(selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("error querying orders: %w", err)
	}
	defer rows.Close()

	var orders []models.Order
	for rows.Next() {
		var o models.Order
		var createdAt, updatedAt time.Time
		var sessID sql.NullString
		var orderType string
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
			&orderType,
		); err != nil {
			return nil, 0, err
		}
		o.TableNameSnapshot = o.TableName
		o.OrderType = models.OrderType(orderType)
		o.CreatedAt = createdAt.Format(time.RFC3339)
		o.UpdatedAt = updatedAt.Format(time.RFC3339)
		if sessID.Valid {
			o.SessionID = &sessID.String
		}
		if o.Subtotal > o.Total {
			o.Discount = o.Subtotal - o.Total
		}
		orders = append(orders, o)
	}

	// Efficient batch loading of lightweight order items (Zero N+1 queries)
	if len(orders) > 0 {
		orderIDs := make([]string, len(orders))
		orderIndexMap := make(map[string]int, len(orders))
		for i, o := range orders {
			orderIDs[i] = o.ID
			orderIndexMap[o.ID] = i
			orders[i].Items = []models.OrderItem{}
			orders[i].Events = []models.OrderEvent{}
		}

		itemQuery := `
			SELECT id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, COALESCE(notes, ''), line_total
			FROM order_items
			WHERE order_id = ANY($1)
			ORDER BY id ASC
		`
		itemRows, err := r.db.Query(itemQuery, pq.Array(orderIDs))
		if err == nil {
			defer itemRows.Close()
			for itemRows.Next() {
				var it models.OrderItem
				var ordID string
				if err := itemRows.Scan(
					&it.ID,
					&ordID,
					&it.ProductID,
					&it.ProductNameSnapshot,
					&it.UnitPriceSnapshot,
					&it.Quantity,
					&it.Notes,
					&it.LineTotal,
				); err == nil {
					it.SelectedOptions = []models.SelectedOptionSnapshot{}
					if idx, ok := orderIndexMap[ordID]; ok {
						orders[idx].Items = append(orders[idx].Items, it)
					}
				}
			}
		}
	}

	if orders == nil {
		orders = []models.Order{}
	}

	return orders, total, nil
}

// ==========================================
// 6. PROMOTIONS CRUD
// ==========================================

func (r *AdminRepository) ListPromotions(restaurantID string) ([]models.Promotion, error) {
	query := `
		SELECT 
			id, restaurant_id, code, title, discount_type, discount_value,
			min_order_amount, max_discount_amount, start_date, end_date,
			is_active, usage_limit, times_used, created_at, updated_at
		FROM promotions
		WHERE restaurant_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(query, restaurantID)
	if err != nil {
		return nil, fmt.Errorf("error querying promotions: %w", err)
	}
	defer rows.Close()

	var promos []models.Promotion
	for rows.Next() {
		var p models.Promotion
		var maxDisc sql.NullFloat64
		var startDt, endDt sql.NullTime
		var usageLim sql.NullInt64
		if err := rows.Scan(
			&p.ID,
			&p.RestaurantID,
			&p.Code,
			&p.Title,
			&p.DiscountType,
			&p.DiscountValue,
			&p.MinOrderAmount,
			&maxDisc,
			&startDt,
			&endDt,
			&p.IsActive,
			&usageLim,
			&p.TimesUsed,
			&p.CreatedAt,
			&p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if maxDisc.Valid {
			v := maxDisc.Float64
			p.MaxDiscountAmount = &v
		}
		if startDt.Valid {
			s := startDt.Time.Format(time.RFC3339)
			p.StartDate = &s
		}
		if endDt.Valid {
			s := endDt.Time.Format(time.RFC3339)
			p.EndDate = &s
		}
		if usageLim.Valid {
			u := int(usageLim.Int64)
			p.UsageLimit = &u
		}
		promos = append(promos, p)
	}
	if promos == nil {
		promos = []models.Promotion{}
	}
	return promos, nil
}

func (r *AdminRepository) CreatePromotion(p *models.Promotion) error {
	query := `
		INSERT INTO promotions (
			id, restaurant_id, code, title, discount_type, discount_value,
			min_order_amount, max_discount_amount, start_date, end_date,
			is_active, usage_limit, times_used, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, NOW(), NOW()
		)
	`
	var startDt, endDt interface{}
	if p.StartDate != nil && *p.StartDate != "" {
		t, err := time.Parse(time.RFC3339, *p.StartDate)
		if err == nil {
			startDt = t
		}
	}
	if p.EndDate != nil && *p.EndDate != "" {
		t, err := time.Parse(time.RFC3339, *p.EndDate)
		if err == nil {
			endDt = t
		}
	}

	_, err := r.db.Exec(
		query,
		p.ID,
		p.RestaurantID,
		strings.ToUpper(strings.TrimSpace(p.Code)),
		strings.TrimSpace(p.Title),
		p.DiscountType,
		p.DiscountValue,
		p.MinOrderAmount,
		p.MaxDiscountAmount,
		startDt,
		endDt,
		p.IsActive,
		p.UsageLimit,
	)
	return err
}

func (r *AdminRepository) GetPromotionByID(restaurantID, promoID string) (*models.Promotion, error) {
	query := `
		SELECT 
			id, restaurant_id, code, title, discount_type, discount_value,
			min_order_amount, max_discount_amount, start_date, end_date,
			is_active, usage_limit, times_used, created_at, updated_at
		FROM promotions
		WHERE id = $1 AND restaurant_id = $2
	`
	row := r.db.QueryRow(query, promoID, restaurantID)
	var p models.Promotion
	var maxDisc sql.NullFloat64
	var startDt, endDt sql.NullTime
	var usageLim sql.NullInt64
	if err := row.Scan(
		&p.ID,
		&p.RestaurantID,
		&p.Code,
		&p.Title,
		&p.DiscountType,
		&p.DiscountValue,
		&p.MinOrderAmount,
		&maxDisc,
		&startDt,
		&endDt,
		&p.IsActive,
		&usageLim,
		&p.TimesUsed,
		&p.CreatedAt,
		&p.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if maxDisc.Valid {
		v := maxDisc.Float64
		p.MaxDiscountAmount = &v
	}
	if startDt.Valid {
		s := startDt.Time.Format(time.RFC3339)
		p.StartDate = &s
	}
	if endDt.Valid {
		s := endDt.Time.Format(time.RFC3339)
		p.EndDate = &s
	}
	if usageLim.Valid {
		u := int(usageLim.Int64)
		p.UsageLimit = &u
	}
	return &p, nil
}

func (r *AdminRepository) UpdatePromotion(restaurantID, promoID string, req models.UpdatePromotionRequest) (*models.Promotion, error) {
	setClauses := []string{"updated_at = NOW()"}
	args := []interface{}{promoID, restaurantID}
	argIdx := 3

	if req.Title != nil {
		setClauses = append(setClauses, fmt.Sprintf("title = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.Title))
		argIdx++
	}
	if req.DiscountType != nil {
		setClauses = append(setClauses, fmt.Sprintf("discount_type = $%d", argIdx))
		args = append(args, strings.ToUpper(strings.TrimSpace(*req.DiscountType)))
		argIdx++
	}
	if req.DiscountValue != nil {
		setClauses = append(setClauses, fmt.Sprintf("discount_value = $%d", argIdx))
		args = append(args, *req.DiscountValue)
		argIdx++
	}
	if req.MinOrderAmount != nil {
		setClauses = append(setClauses, fmt.Sprintf("min_order_amount = $%d", argIdx))
		args = append(args, *req.MinOrderAmount)
		argIdx++
	}
	if req.MaxDiscountAmount != nil {
		setClauses = append(setClauses, fmt.Sprintf("max_discount_amount = $%d", argIdx))
		args = append(args, *req.MaxDiscountAmount)
		argIdx++
	}
	if req.StartDate != nil {
		var startDt interface{}
		if *req.StartDate != "" {
			if t, err := time.Parse(time.RFC3339, *req.StartDate); err == nil {
				startDt = t
			}
		}
		setClauses = append(setClauses, fmt.Sprintf("start_date = $%d", argIdx))
		args = append(args, startDt)
		argIdx++
	}
	if req.EndDate != nil {
		var endDt interface{}
		if *req.EndDate != "" {
			if t, err := time.Parse(time.RFC3339, *req.EndDate); err == nil {
				endDt = t
			}
		}
		setClauses = append(setClauses, fmt.Sprintf("end_date = $%d", argIdx))
		args = append(args, endDt)
		argIdx++
	}
	if req.IsActive != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *req.IsActive)
		argIdx++
	}
	if req.UsageLimit != nil {
		setClauses = append(setClauses, fmt.Sprintf("usage_limit = $%d", argIdx))
		args = append(args, *req.UsageLimit)
		argIdx++
	}

	query := fmt.Sprintf("UPDATE promotions SET %s WHERE id = $1 AND restaurant_id = $2", strings.Join(setClauses, ", "))
	res, err := r.db.Exec(query, args...)
	if err != nil {
		return nil, err
	}
	rows, err := res.RowsAffected()
	if err != nil || rows == 0 {
		return nil, errors.New("العرض الترويجي غير موجود")
	}

	return r.GetPromotionByID(restaurantID, promoID)
}

func (r *AdminRepository) DeletePromotion(restaurantID, promoID string) error {
	res, err := r.db.Exec("DELETE FROM promotions WHERE id = $1 AND restaurant_id = $2", promoID, restaurantID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil || rows == 0 {
		return errors.New("العرض الترويجي غير موجود")
	}
	return nil
}

func GenerateUUID() string {
	return uuid.New().String()
}
