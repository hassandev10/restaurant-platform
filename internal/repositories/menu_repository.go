package repositories

import (
	"database/sql"
	"fmt"
	"strings"

	"smart-restaurant-api/internal/database"
	"smart-restaurant-api/internal/models"
)

type MenuRepository struct {
	db *database.DB
}

func NewMenuRepository(db *database.DB) *MenuRepository {
	return &MenuRepository{db: db}
}

func (m *MenuRepository) GetCategories(restaurantID string) ([]models.MenuCategory, error) {
	query := `
		SELECT id, restaurant_id, name_ar, COALESCE(name_en, ''), display_order, is_active, COALESCE(icon_name, '')
		FROM menu_categories
		WHERE restaurant_id = $1 AND is_active = true
		ORDER BY display_order ASC
	`
	rows, err := m.db.Query(query, restaurantID)
	if err != nil {
		return nil, fmt.Errorf("error querying categories: %w", err)
	}
	defer rows.Close()

	var categories []models.MenuCategory
	for rows.Next() {
		var c models.MenuCategory
		if err := rows.Scan(&c.ID, &c.RestaurantID, &c.NameAr, &c.NameEn, &c.DisplayOrder, &c.IsActive, &c.IconName); err != nil {
			return nil, err
		}
		categories = append(categories, c)
	}
	return categories, nil
}

func (m *MenuRepository) GetProducts(restaurantID, categoryID, search string) ([]models.Product, error) {
	baseQuery := `
		SELECT id, restaurant_id, category_id, name_ar, COALESCE(name_en, ''), COALESCE(description, ''),
		       price, COALESCE(image_url, ''), is_available, is_featured, COALESCE(badge, '')
		FROM menu_products
		WHERE restaurant_id = $1
	`
	args := []interface{}{restaurantID}
	argIdx := 2

	if categoryID != "" && categoryID != "all" {
		baseQuery += fmt.Sprintf(" AND category_id = $%d", argIdx)
		args = append(args, categoryID)
		argIdx++
	}

	if search != "" {
		trimmed := strings.ToLower(strings.TrimSpace(search))
		baseQuery += fmt.Sprintf(" AND (LOWER(name_ar) LIKE $%d OR LOWER(COALESCE(name_en, '')) LIKE $%d OR LOWER(COALESCE(description, '')) LIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, "%"+trimmed+"%")
		argIdx++
	}

	baseQuery += " ORDER BY display_order ASC, created_at ASC"

	rows, err := m.db.Query(baseQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("error querying products: %w", err)
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
			return nil, err
		}
		products = append(products, p)
	}

	// Fetch option groups and options for all products
	for i := range products {
		options, err := m.GetProductOptions(products[i].ID)
		if err != nil {
			return nil, err
		}
		products[i].Options = options
	}

	return products, nil
}

func (m *MenuRepository) GetProductByID(productID string) (*models.Product, error) {
	query := `
		SELECT id, restaurant_id, category_id, name_ar, COALESCE(name_en, ''), COALESCE(description, ''),
		       price, COALESCE(image_url, ''), is_available, is_featured, COALESCE(badge, '')
		FROM menu_products
		WHERE id = $1
	`
	row := m.db.QueryRow(query, productID)

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
		return nil, fmt.Errorf("error querying product by id: %w", err)
	}

	options, err := m.GetProductOptions(p.ID)
	if err != nil {
		return nil, err
	}
	p.Options = options

	return &p, nil
}

func (m *MenuRepository) GetProductOptions(productID string) ([]models.ProductOptionGroup, error) {
	queryGroups := `
		SELECT id, name_ar, selection_type, is_required, min_selections, max_selections
		FROM product_option_groups
		WHERE product_id = $1
		ORDER BY display_order ASC
	`
	groupRows, err := m.db.Query(queryGroups, productID)
	if err != nil {
		return nil, fmt.Errorf("error querying option groups: %w", err)
	}
	defer groupRows.Close()

	var groups []models.ProductOptionGroup
	for groupRows.Next() {
		var g models.ProductOptionGroup
		if err := groupRows.Scan(&g.ID, &g.NameAr, &g.SelectionType, &g.IsRequired, &g.MinSelections, &g.MaxSelections); err != nil {
			return nil, err
		}

		// Query individual options
		queryOptions := `
			SELECT id, name_ar, price_delta, is_available
			FROM product_options
			WHERE group_id = $1
			ORDER BY display_order ASC
		`
		optRows, err := m.db.Query(queryOptions, g.ID)
		if err != nil {
			return nil, fmt.Errorf("error querying options for group %s: %w", g.ID, err)
		}

		var options []models.ProductOption
		for optRows.Next() {
			var opt models.ProductOption
			if err := optRows.Scan(&opt.ID, &opt.NameAr, &opt.PriceDelta, &opt.IsAvailable); err != nil {
				optRows.Close()
				return nil, err
			}
			options = append(options, opt)
		}
		optRows.Close()

		g.Options = options
		groups = append(groups, g)
	}

	if groups == nil {
		groups = []models.ProductOptionGroup{}
	}
	return groups, nil
}
