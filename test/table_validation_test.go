package test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"smart-restaurant-api/internal/config"
	"smart-restaurant-api/internal/database"
	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/services"
)

func TestTableValidationAndQRIdentification(t *testing.T) {
	router := setupTestRouter(t)
	token := getAdminAuthToken(t, router)
	cfg := config.LoadConfig()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		t.Fatalf("Failed to connect to DB: %v", err)
	}
	defer db.Close()

	// 1. Valid Table Number Validation
	var validatedContext models.TableValidationResponse
	t.Run("ValidTableNumber", func(t *testing.T) {
		payload := models.TableValidationRequest{TableNumber: "4"}
		body, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", "/api/v1/public/restaurants/demo-restaurant/table-validation", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}

		if err := json.Unmarshal(w.Body.Bytes(), &validatedContext); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if !validatedContext.Success {
			t.Fatalf("Expected success: true")
		}
		if validatedContext.Table.TableNumber != "4" {
			t.Fatalf("Expected table number '4', got '%s'", validatedContext.Table.TableNumber)
		}
		if validatedContext.TableContextToken == "" {
			t.Fatalf("Expected tableContextToken to be generated")
		}
		if validatedContext.TableToken == "" {
			t.Fatalf("Expected tableToken to be returned")
		}
		if !validatedContext.CanOrder {
			t.Fatalf("Expected canOrder: true")
		}
	})

	// 2. Unknown Table Number
	t.Run("UnknownTableNumber", func(t *testing.T) {
		payload := models.TableValidationRequest{TableNumber: "99999"}
		body, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", "/api/v1/public/restaurants/demo-restaurant/table-validation", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Fatalf("Expected 404 Not Found for unknown table, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 3. Unknown Restaurant
	t.Run("UnknownRestaurant", func(t *testing.T) {
		payload := models.TableValidationRequest{TableNumber: "4"}
		body, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", "/api/v1/public/restaurants/non-existent-restaurant-slug/table-validation", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Fatalf("Expected 404 Not Found for unknown restaurant, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 4. Same Number in Different Restaurants
	t.Run("SameNumberInDifferentRestaurants", func(t *testing.T) {
		// Create a second test restaurant
		secondRestID := fmt.Sprintf("rest-test-%d", time.Now().UnixNano())
		secondRestSlug := fmt.Sprintf("test-rest-%d", time.Now().UnixNano())
		_, err := db.Exec(`
			INSERT INTO restaurants (id, name, slug, description, currency, is_open, created_at, updated_at)
			VALUES ($1, 'مطعم الاختبار الثاني', $2, 'وصف', 'EGP', true, NOW(), NOW())
		`, secondRestID, secondRestSlug)
		if err != nil {
			t.Fatalf("Failed to create second restaurant: %v", err)
		}

		// Table 4 does NOT exist in second restaurant yet -> must 404
		payload := models.TableValidationRequest{TableNumber: "4"}
		body, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", fmt.Sprintf("/api/v1/public/restaurants/%s/table-validation", secondRestSlug), bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusNotFound {
			t.Fatalf("Expected 404 when table 4 does not exist in second restaurant, got %d", w.Code)
		}

		// Now add table 4 to second restaurant with its own unique token
		secondTableToken := fmt.Sprintf("tok-sec-%s", uuid.New().String()[:8])
		_, err = db.Exec(`
			INSERT INTO dining_tables (id, restaurant_id, table_number, display_name, name, capacity, token, status, is_active, created_at, updated_at)
			VALUES ($1, $2, '4', 'طاولة 4 مطعم 2', 'طاولة 4', 4, $3, 'AVAILABLE', true, NOW(), NOW())
		`, fmt.Sprintf("tbl-sec-%s", uuid.New().String()[:8]), secondRestID, secondTableToken)
		if err != nil {
			t.Fatalf("Failed to insert table in second restaurant: %v", err)
		}

		// Now validating table 4 in second restaurant succeeds and binds to second restaurant!
		body2, _ := json.Marshal(payload)
		req2, _ := http.NewRequest("POST", fmt.Sprintf("/api/v1/public/restaurants/%s/table-validation", secondRestSlug), bytes.NewBuffer(body2))
		req2.Header.Set("Content-Type", "application/json")
		w2 := httptest.NewRecorder()
		router.ServeHTTP(w2, req2)
		if w2.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for table 4 in second restaurant, got %d: %s", w2.Code, w2.Body.String())
		}

		var res2 models.TableValidationResponse
		_ = json.Unmarshal(w2.Body.Bytes(), &res2)
		if res2.Restaurant.Slug != secondRestSlug {
			t.Fatalf("Expected restaurant slug %s, got %s", secondRestSlug, res2.Restaurant.Slug)
		}
		if res2.TableToken != secondTableToken {
			t.Fatalf("Expected token %s, got %s", secondTableToken, res2.TableToken)
		}
	})

	// 5. Disabled and Out of Service Tables
	t.Run("DisabledAndOutOfServiceTables", func(t *testing.T) {
		uid := uuid.New().String()[:6]
		// Out of service table
		oosTableNumber := fmt.Sprintf("OOS_%s", uid)
		oosToken := fmt.Sprintf("tok-oos-%s", uid)
		_, err := db.Exec(`
			INSERT INTO dining_tables (id, restaurant_id, table_number, display_name, name, capacity, token, status, is_active, created_at, updated_at)
			VALUES ($1, 'rest-01', $2, 'طاولة معطلة صيانة', 'صيانة', 4, $3, 'OUT_OF_SERVICE', true, NOW(), NOW())
		`, fmt.Sprintf("tbl-oos-%s", uid), oosTableNumber, oosToken)
		if err != nil {
			t.Fatalf("Failed to create OOS table: %v", err)
		}

		payload := models.TableValidationRequest{TableNumber: oosTableNumber}
		body, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", "/api/v1/public/restaurants/demo-restaurant/table-validation", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusConflict {
			t.Fatalf("Expected 409 Conflict for OUT_OF_SERVICE table, got %d: %s", w.Code, w.Body.String())
		}

		// Soft disabled table (is_active = false)
		uidDis := uuid.New().String()[:6]
		disTableNumber := fmt.Sprintf("DIS_%s", uidDis)
		disToken := fmt.Sprintf("tok-dis-%s", uidDis)
		_, err = db.Exec(`
			INSERT INTO dining_tables (id, restaurant_id, table_number, display_name, name, capacity, token, status, is_active, created_at, updated_at)
			VALUES ($1, 'rest-01', $2, 'طاولة معطلة', 'معطلة', 4, $3, 'AVAILABLE', false, NOW(), NOW())
		`, fmt.Sprintf("tbl-dis-%s", uidDis), disTableNumber, disToken)
		if err != nil {
			t.Fatalf("Failed to create disabled table: %v", err)
		}

		payloadDis := models.TableValidationRequest{TableNumber: disTableNumber}
		bodyDis, _ := json.Marshal(payloadDis)
		reqDis, _ := http.NewRequest("POST", "/api/v1/public/restaurants/demo-restaurant/table-validation", bytes.NewBuffer(bodyDis))
		reqDis.Header.Set("Content-Type", "application/json")

		wDis := httptest.NewRecorder()
		router.ServeHTTP(wDis, reqDis)
		if wDis.Code != http.StatusBadRequest {
			t.Fatalf("Expected 400 Bad Request for is_active=false table, got %d: %s", wDis.Code, wDis.Body.String())
		}
	})

	// 6. Occupied Table Behavior (allows ordering & joins session)
	t.Run("OccupiedTableBehavior", func(t *testing.T) {
		uidOcc := uuid.New().String()[:8]
		occTableNumber := fmt.Sprintf("OCC_%s", uidOcc)
		occToken := fmt.Sprintf("tok-occ-%s", uidOcc)
		occTableID := fmt.Sprintf("tbl-occ-%s", uidOcc)
		_, err := db.Exec(`
			INSERT INTO dining_tables (id, restaurant_id, table_number, display_name, name, capacity, token, status, is_active, created_at, updated_at)
			VALUES ($1, 'rest-01', $2, 'طاولة مشغولة', 'مشغولة', 4, $3, 'OCCUPIED', true, NOW(), NOW())
		`, occTableID, occTableNumber, occToken)
		if err != nil {
			t.Fatalf("Failed to create OCCUPIED table: %v", err)
		}

		// Open session for it
		sessID := fmt.Sprintf("sess-test-%s", uidOcc)
		_, err = db.Exec(`
			INSERT INTO table_sessions (id, restaurant_id, table_id, opened_by, opened_at, status)
			VALUES ($1, 'rest-01', $2, 'staff-01', NOW(), 'OPEN')
		`, sessID, occTableID)
		if err != nil {
			t.Fatalf("Failed to create session: %v", err)
		}

		payload := models.TableValidationRequest{TableNumber: occTableNumber}
		body, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", "/api/v1/public/restaurants/demo-restaurant/table-validation", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for occupied table, got %d: %s", w.Code, w.Body.String())
		}

		var res models.TableValidationResponse
		_ = json.Unmarshal(w.Body.Bytes(), &res)
		if !res.CanOrder {
			t.Fatalf("Expected CanOrder to be true for occupied table to allow additional orders")
		}
		if res.SessionID == nil || *res.SessionID != sessID {
			t.Fatalf("Expected SessionID to be %s, got %+v", sessID, res.SessionID)
		}
	})

	// 7. Order Creation Requires Valid Context
	t.Run("OrderCreationWithoutContextFails", func(t *testing.T) {
		orderPayload := models.CreateOrderRequest{
			RestaurantID: "rest-01",
			TableID:      "table-04",
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-01",
					Quantity:  1,
					SelectedOptions: []models.CreateOrderItemOptionRequest{
						{GroupID: "opt-size-grill", OptionID: "size-half"},
					},
				},
			},
		}
		body, _ := json.Marshal(orderPayload)
		req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusUnprocessableEntity {
			t.Fatalf("Expected 422 Unprocessable Entity when creating order without table context, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 8. Order Creation with Valid TableContextToken Succeeds
	t.Run("OrderCreationWithTableContextTokenSucceeds", func(t *testing.T) {
		orderPayload := models.CreateOrderRequest{
			TableContextToken: validatedContext.TableContextToken,
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-01",
					Quantity:  1,
					SelectedOptions: []models.CreateOrderItemOptionRequest{
						{GroupID: "opt-size-grill", OptionID: "size-half"},
					},
					Notes: "مع سلطة إضافية",
				},
			},
		}
		body, _ := json.Marshal(orderPayload)
		req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created with valid TableContextToken, got %d: %s", w.Code, w.Body.String())
		}

		var created models.Order
		_ = json.Unmarshal(w.Body.Bytes(), &created)
		if created.TableID != "table-04" {
			t.Fatalf("Expected authoritative TableID 'table-04', got %s", created.TableID)
		}
		if created.RestaurantID != "rest-01" {
			t.Fatalf("Expected authoritative RestaurantID 'rest-01', got %s", created.RestaurantID)
		}
	})

	// 9. Client Attempts to Submit Mismatched Table ID (Anti-Tampering)
	t.Run("RejectMismatchedTableIDTampering", func(t *testing.T) {
		orderPayload := models.CreateOrderRequest{
			TableContextToken: validatedContext.TableContextToken, // Token is for table-04
			TableID:           "table-02",                         // Client maliciously tries to bill table-02!
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-01",
					Quantity:  1,
					SelectedOptions: []models.CreateOrderItemOptionRequest{
						{GroupID: "opt-size-grill", OptionID: "size-half"},
					},
				},
			},
		}
		body, _ := json.Marshal(orderPayload)
		req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnprocessableEntity {
			t.Fatalf("Expected 422 for mismatched TableID tampering, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 10. Token Reuse Across Restaurants Rejection
	t.Run("RejectTokenReuseAcrossRestaurants", func(t *testing.T) {
		orderPayload := models.CreateOrderRequest{
			TableContextToken: validatedContext.TableContextToken, // Token is for rest-01
			RestaurantID:      "rest-fake-other",                  // Sending to another restaurant
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-01",
					Quantity:  1,
					SelectedOptions: []models.CreateOrderItemOptionRequest{
						{GroupID: "opt-size-grill", OptionID: "size-half"},
					},
				},
			},
		}
		body, _ := json.Marshal(orderPayload)
		req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnprocessableEntity {
			t.Fatalf("Expected 422 for cross-restaurant token reuse, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 11. Invalid and Expired Context Rejection
	t.Run("RejectInvalidOrExpiredContext", func(t *testing.T) {
		// 1. Completely forged JWT
		orderPayload := models.CreateOrderRequest{
			TableContextToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsignature",
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-01",
					Quantity:  1,
					SelectedOptions: []models.CreateOrderItemOptionRequest{
						{GroupID: "opt-size-grill", OptionID: "size-half"},
					},
				},
			},
		}
		body, _ := json.Marshal(orderPayload)
		req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnprocessableEntity {
			t.Fatalf("Expected 422 for invalid JWT, got %d: %s", w.Code, w.Body.String())
		}

		// 2. Expired JWT
		expiredClaims := &services.TableContextClaims{
			Type:           "table_context",
			RestaurantID:   "rest-01",
			RestaurantSlug: "demo-restaurant",
			TableID:        "table-04",
			TableNumber:    "4",
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)), // Expired 2 hours ago!
				IssuedAt:  jwt.NewNumericDate(time.Now().Add(-4 * time.Hour)),
			},
		}
		expTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, expiredClaims)
		expiredTokenStr, _ := expTokenObj.SignedString([]byte(cfg.JWTSecret))

		orderPayloadExp := models.CreateOrderRequest{
			TableContextToken: expiredTokenStr,
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-01",
					Quantity:  1,
					SelectedOptions: []models.CreateOrderItemOptionRequest{
						{GroupID: "opt-size-grill", OptionID: "size-half"},
					},
				},
			},
		}
		bodyExp, _ := json.Marshal(orderPayloadExp)
		reqExp, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(bodyExp))
		reqExp.Header.Set("Content-Type", "application/json")

		wExp := httptest.NewRecorder()
		router.ServeHTTP(wExp, reqExp)

		if wExp.Code != http.StatusUnprocessableEntity {
			t.Fatalf("Expected 422 for expired JWT, got %d: %s", wExp.Code, wExp.Body.String())
		}
	})

	// 12. Staff QR Management (Get QR & Regenerate Token)
	t.Run("StaffQRManagementAndRegeneration", func(t *testing.T) {
		// 1. Get Table QR Details
		req, _ := http.NewRequest("GET", "/api/v1/tables/table-04/qr", nil)
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for GET /tables/table-04/qr, got %d: %s", w.Code, w.Body.String())
		}

		var qrResp models.TableQRResponse
		if err := json.Unmarshal(w.Body.Bytes(), &qrResp); err != nil {
			t.Fatalf("Failed to parse QR response: %v", err)
		}

		if qrResp.CustomerURL == "" || qrResp.Token == "" {
			t.Fatalf("Expected non-empty CustomerURL and Token: %+v", qrResp)
		}
		originalToken := qrResp.Token

		// 2. Regenerate Table QR Token
		reqRegen, _ := http.NewRequest("POST", "/api/v1/tables/table-04/qr/regenerate", nil)
		reqRegen.Header.Set("Authorization", "Bearer "+token)

		wRegen := httptest.NewRecorder()
		router.ServeHTTP(wRegen, reqRegen)

		if wRegen.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for regenerate QR, got %d: %s", wRegen.Code, wRegen.Body.String())
		}

		var regenResp models.TableQRResponse
		_ = json.Unmarshal(wRegen.Body.Bytes(), &regenResp)

		if regenResp.Token == originalToken {
			t.Fatalf("Expected new token after regeneration, but got old token: %s", regenResp.Token)
		}

		// Restore original token for subsequent test runs
		_, _ = db.Exec("UPDATE dining_tables SET token = $1 WHERE id = 'table-04'", originalToken)
	})

	// 13. Public QR Token Resolution
	t.Run("PublicQRTokenResolution", func(t *testing.T) {
		// Resolving 'demo-table-token'
		req, _ := http.NewRequest("GET", "/api/v1/public/qr/demo-table-token", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for public QR resolution, got %d: %s", w.Code, w.Body.String())
		}

		var resolved models.TableValidationResponse
		_ = json.Unmarshal(w.Body.Bytes(), &resolved)
		if resolved.Table.TableNumber != "4" {
			t.Fatalf("Expected table number 4, got %s", resolved.Table.TableNumber)
		}
		if resolved.TableContextToken == "" {
			t.Fatalf("Expected TableContextToken to be returned from public QR resolution")
		}

		// Invalid token resolution returns 404
		reqFake, _ := http.NewRequest("GET", "/api/v1/public/qr/fake-non-existent-token", nil)
		wFake := httptest.NewRecorder()
		router.ServeHTTP(wFake, reqFake)
		if wFake.Code != http.StatusNotFound {
			t.Fatalf("Expected 404 for invalid QR token, got %d", wFake.Code)
		}
	})
}
