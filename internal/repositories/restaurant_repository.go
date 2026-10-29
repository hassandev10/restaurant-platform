package repositories

import (
	"database/sql"
	"fmt"
	"strings"

	"smart-restaurant-api/internal/database"
	"smart-restaurant-api/internal/models"
)

type RestaurantRepository struct {
	db *database.DB
}

func NewRestaurantRepository(db *database.DB) *RestaurantRepository {
	return &RestaurantRepository{db: db}
}

func (r *RestaurantRepository) GetRestaurantBySlug(slug string) (*models.Restaurant, error) {
	query := `
		SELECT id, name, slug, description, logo_url, currency, is_open, estimated_prep_minutes, created_at, updated_at
		FROM restaurants
		WHERE LOWER(slug) = LOWER($1)
	`
	row := r.db.QueryRow(query, strings.TrimSpace(slug))

	var rest models.Restaurant
	var desc, logo sql.NullString
	err := row.Scan(
		&rest.ID,
		&rest.Name,
		&rest.Slug,
		&desc,
		&logo,
		&rest.Currency,
		&rest.IsOpen,
		&rest.EstimatedPreparationMinutes,
		&rest.CreatedAt,
		&rest.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying restaurant: %w", err)
	}
	rest.Description = desc.String
	rest.LogoURL = logo.String
	return &rest, nil
}

func (r *RestaurantRepository) GetRestaurantByID(id string) (*models.Restaurant, error) {
	query := `
		SELECT id, name, slug, description, logo_url, currency, is_open, estimated_prep_minutes, created_at, updated_at
		FROM restaurants
		WHERE id = $1
	`
	row := r.db.QueryRow(query, id)

	var rest models.Restaurant
	var desc, logo sql.NullString
	err := row.Scan(
		&rest.ID,
		&rest.Name,
		&rest.Slug,
		&desc,
		&logo,
		&rest.Currency,
		&rest.IsOpen,
		&rest.EstimatedPreparationMinutes,
		&rest.CreatedAt,
		&rest.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying restaurant by id: %w", err)
	}
	rest.Description = desc.String
	rest.LogoURL = logo.String
	return &rest, nil
}

func (r *RestaurantRepository) GetTableByToken(restaurantID, token string) (*models.RestaurantTable, error) {
	query := `
		SELECT id, restaurant_id, COALESCE(branch_id, ''), name, token, status, created_at
		FROM dining_tables
		WHERE restaurant_id = $1 AND LOWER(token) = LOWER($2)
	`
	row := r.db.QueryRow(query, restaurantID, strings.TrimSpace(token))

	var table models.RestaurantTable
	err := row.Scan(
		&table.ID,
		&table.RestaurantID,
		&table.BranchID,
		&table.Name,
		&table.Token,
		&table.Status,
		&table.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying table: %w", err)
	}
	return &table, nil
}

func (r *RestaurantRepository) GetTableByID(id string) (*models.RestaurantTable, error) {
	query := `
		SELECT id, restaurant_id, COALESCE(branch_id, ''), name, token, status, created_at
		FROM dining_tables
		WHERE id = $1
	`
	row := r.db.QueryRow(query, id)

	var table models.RestaurantTable
	err := row.Scan(
		&table.ID,
		&table.RestaurantID,
		&table.BranchID,
		&table.Name,
		&table.Token,
		&table.Status,
		&table.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying table by id: %w", err)
	}
	return &table, nil
}

func (r *RestaurantRepository) GetBranchByID(id string) (*models.Branch, error) {
	query := `
		SELECT id, restaurant_id, name, created_at
		FROM restaurant_branches
		WHERE id = $1
	`
	row := r.db.QueryRow(query, id)

	var b models.Branch
	err := row.Scan(&b.ID, &b.RestaurantID, &b.Name, &b.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying branch: %w", err)
	}
	return &b, nil
}
