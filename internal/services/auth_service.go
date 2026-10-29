package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"smart-restaurant-api/internal/config"
	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/repositories"
)

type Claims struct {
	UserID       string `json:"userId"`
	RestaurantID string `json:"restaurantId"`
	BranchID     string `json:"branchId"`
	Role         string `json:"role"`
	Username     string `json:"username"`
	Name         string `json:"name"`
	jwt.RegisteredClaims
}

type AuthService struct {
	authRepo *repositories.AuthRepository
	cfg      *config.Config
}

func NewAuthService(authRepo *repositories.AuthRepository, cfg *config.Config) *AuthService {
	return &AuthService{
		authRepo: authRepo,
		cfg:      cfg,
	}
}

func (s *AuthService) Login(req models.LoginRequest) (*models.LoginResponse, error) {
	user, err := s.authRepo.GetStaffByUsername(req.Username)
	if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}
	if user == nil {
		return nil, errors.New("اسم المستخدم أو كلمة المرور غير صحيحة")
	}

	// Compare bcrypt password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("اسم المستخدم أو كلمة المرور غير صحيحة")
	}

	// Generate JWT Token (valid for 24 hours)
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID:       user.ID,
		RestaurantID: user.RestaurantID,
		BranchID:     user.BranchID,
		Role:         user.Role,
		Username:     user.Username,
		Name:         user.Name,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "smart-restaurant-api",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &models.LoginResponse{
		Token: tokenString,
		User:  *user,
	}, nil
}

func (s *AuthService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.cfg.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

type TableContextClaims struct {
	Type           string `json:"type"` // "table_context"
	RestaurantID   string `json:"restaurantId"`
	RestaurantSlug string `json:"restaurantSlug"`
	BranchID       string `json:"branchId"`
	TableID        string `json:"tableId"`
	TableNumber    string `json:"tableNumber"`
	TableToken     string `json:"tableToken"`
	SessionID      string `json:"sessionId,omitempty"`
	jwt.RegisteredClaims
}

func (s *AuthService) GenerateTableContextToken(table *models.RestaurantTable, restaurant *models.Restaurant, sessionID string) (string, time.Time, error) {
	expirationTime := time.Now().Add(4 * time.Hour)
	branchID := table.BranchID

	claims := &TableContextClaims{
		Type:           "table_context",
		RestaurantID:   table.RestaurantID,
		RestaurantSlug: restaurant.Slug,
		BranchID:       branchID,
		TableID:        table.ID,
		TableNumber:    table.TableNumber,
		TableToken:     table.Token,
		SessionID:      sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "smart-restaurant-api",
			Subject:   table.ID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to sign table context token: %w", err)
	}

	return tokenString, expirationTime, nil
}

func (s *AuthService) ValidateTableContextToken(tokenString string) (*TableContextClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &TableContextClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.cfg.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*TableContextClaims); ok && token.Valid {
		if claims.Type != "table_context" {
			return nil, errors.New("invalid token type: not a table context token")
		}
		return claims, nil
	}

	return nil, errors.New("invalid table context token")
}

