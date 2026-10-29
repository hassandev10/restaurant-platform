package repositories

import (
	"database/sql"
	"fmt"
	"strings"

	"smart-restaurant-api/internal/database"
	"smart-restaurant-api/internal/models"
)

type AuthRepository struct {
	db *database.DB
}

func NewAuthRepository(db *database.DB) *AuthRepository {
	return &AuthRepository{db: db}
}

func (r *AuthRepository) GetStaffByUsername(username string) (*models.StaffUser, error) {
	query := `
		SELECT id, restaurant_id, COALESCE(branch_id, ''), username, password_hash, name, role, is_active, created_at
		FROM staff_users
		WHERE LOWER(username) = LOWER($1) AND is_active = true
	`
	row := r.db.QueryRow(query, strings.TrimSpace(username))

	var u models.StaffUser
	err := row.Scan(
		&u.ID,
		&u.RestaurantID,
		&u.BranchID,
		&u.Username,
		&u.PasswordHash,
		&u.Name,
		&u.Role,
		&u.IsActive,
		&u.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying staff user: %w", err)
	}
	return &u, nil
}

func (r *AuthRepository) GetStaffByID(id string) (*models.StaffUser, error) {
	query := `
		SELECT id, restaurant_id, COALESCE(branch_id, ''), username, password_hash, name, role, is_active, created_at
		FROM staff_users
		WHERE id = $1 AND is_active = true
	`
	row := r.db.QueryRow(query, id)

	var u models.StaffUser
	err := row.Scan(
		&u.ID,
		&u.RestaurantID,
		&u.BranchID,
		&u.Username,
		&u.PasswordHash,
		&u.Name,
		&u.Role,
		&u.IsActive,
		&u.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("error querying staff user by id: %w", err)
	}
	return &u, nil
}
