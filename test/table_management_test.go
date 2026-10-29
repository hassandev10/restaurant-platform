package test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"

	"smart-restaurant-api/internal/models"
)

func getAdminAuthToken(t *testing.T, router http.Handler) string {
	loginPayload := models.LoginRequest{
		Username: "admin",
		Password: "password123",
	}
	body, _ := json.Marshal(loginPayload)
	req, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Failed to login as admin: code %d, body: %s", w.Code, w.Body.String())
	}

	var res models.LoginResponse
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("Failed to decode login response: %v", err)
	}

	return res.Token
}

func TestTableManagementLifecycle(t *testing.T) {
	router := setupTestRouter(t)
	token := getAdminAuthToken(t, router)

	// 1. List Sections
	t.Run("ListSections", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/sections", nil)
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var sections []models.TableSection
		if err := json.Unmarshal(w.Body.Bytes(), &sections); err != nil {
			t.Fatalf("Failed to parse sections: %v", err)
		}
		if len(sections) == 0 {
			t.Fatalf("Expected seeded sections, got 0")
		}
	})

	// 2. Create Section
	var createdSectionID string
	t.Run("CreateSection", func(t *testing.T) {
		secPayload := models.CreateSectionRequest{
			Name:         fmt.Sprintf("قسم تجريبي %d", time.Now().UnixNano()%1000),
			DisplayOrder: 10,
		}
		body, _ := json.Marshal(secPayload)
		req, _ := http.NewRequest("POST", "/api/v1/sections", bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
		}

		var sec models.TableSection
		if err := json.Unmarshal(w.Body.Bytes(), &sec); err != nil {
			t.Fatalf("Failed to parse section: %v", err)
		}
		if sec.ID == "" || sec.Name != secPayload.Name {
			t.Fatalf("Invalid section returned: %+v", sec)
		}
		createdSectionID = sec.ID
	})

	// 3. Create Table
	testTableNumber := fmt.Sprintf("T%d_%s", time.Now().UnixNano()%10000, uuid.New().String()[:4])
	var createdTableID string
	var createdTableToken string
	t.Run("CreateTable", func(t *testing.T) {
		createPayload := models.CreateTableRequest{
			TableNumber: testTableNumber,
			DisplayName: "طاولة الاختبار الذكية",
			Capacity:    6,
			SectionID:   createdSectionID,
		}
		body, _ := json.Marshal(createPayload)
		req, _ := http.NewRequest("POST", "/api/v1/tables", bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
		}

		var table models.RestaurantTable
		if err := json.Unmarshal(w.Body.Bytes(), &table); err != nil {
			t.Fatalf("Failed to parse created table: %v", err)
		}

		if table.ID == "" || table.TableNumber != testTableNumber || table.Capacity != 6 {
			t.Fatalf("Unexpected table values: %+v", table)
		}
		if table.Status != models.TableStatusAvailable {
			t.Fatalf("Expected table initial status to be AVAILABLE, got %s", table.Status)
		}
		createdTableID = table.ID
		createdTableToken = table.Token
	})

	// 4. Duplicate Table Number Rejection
	t.Run("RejectDuplicateTableNumber", func(t *testing.T) {
		dupPayload := models.CreateTableRequest{
			TableNumber: testTableNumber,
			DisplayName: "طاولة مكررة",
			Capacity:    4,
		}
		body, _ := json.Marshal(dupPayload)
		req, _ := http.NewRequest("POST", "/api/v1/tables", bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusConflict {
			t.Fatalf("Expected 409 Conflict for duplicate table number, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 5. List Tables with Filters & Pagination
	t.Run("ListTablesWithFilter", func(t *testing.T) {
		url := fmt.Sprintf("/api/v1/tables?search=%s&page=1&pageSize=10", testTableNumber)
		req, _ := http.NewRequest("GET", url, nil)
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp models.PaginatedTablesResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("Failed to parse tables response: %v", err)
		}

		if resp.Total < 1 || len(resp.Tables) < 1 {
			t.Fatalf("Expected at least 1 table matching search, got total=%d", resp.Total)
		}
		if resp.Tables[0].TableNumber != testTableNumber {
			t.Fatalf("Expected table number %s, got %s", testTableNumber, resp.Tables[0].TableNumber)
		}
	})

	// 6. Get Table Details
	t.Run("GetTableDetails", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/v1/tables/"+createdTableID, nil)
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var table models.RestaurantTable
		if err := json.Unmarshal(w.Body.Bytes(), &table); err != nil {
			t.Fatalf("Failed to parse table: %v", err)
		}
		if table.ID != createdTableID {
			t.Fatalf("Expected ID %s, got %s", createdTableID, table.ID)
		}
	})

	// 7. Update Table (Capacity & Display Name)
	t.Run("UpdateTable", func(t *testing.T) {
		newCap := 8
		newDisplay := "طاولة VIP 8 أفراد"
		updatePayload := models.UpdateTableRequest{
			Capacity:    &newCap,
			DisplayName: &newDisplay,
		}
		body, _ := json.Marshal(updatePayload)
		req, _ := http.NewRequest("PATCH", "/api/v1/tables/"+createdTableID, bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var updated models.RestaurantTable
		if err := json.Unmarshal(w.Body.Bytes(), &updated); err != nil {
			t.Fatalf("Failed to parse updated table: %v", err)
		}
		if updated.Capacity != 8 || updated.DisplayName != newDisplay {
			t.Fatalf("Table update failed: %+v", updated)
		}
	})

	// 8. Open Table Session
	var sessionID string
	t.Run("OpenTableSession", func(t *testing.T) {
		openPayload := models.OpenSessionRequest{
			Notes: "جلسة عشاء عائلي",
		}
		body, _ := json.Marshal(openPayload)
		req, _ := http.NewRequest("POST", fmt.Sprintf("/api/v1/tables/%s/sessions", createdTableID), bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created for session open, got %d: %s", w.Code, w.Body.String())
		}

		var session models.TableSession
		if err := json.Unmarshal(w.Body.Bytes(), &session); err != nil {
			t.Fatalf("Failed to parse session: %v", err)
		}
		if session.ID == "" || session.Status != models.SessionStatusOpen {
			t.Fatalf("Invalid session returned: %+v", session)
		}
		sessionID = session.ID

		// Verify table status is now OCCUPIED
		detailsReq, _ := http.NewRequest("GET", "/api/v1/tables/"+createdTableID, nil)
		detailsReq.Header.Set("Authorization", "Bearer "+token)
		wDetails := httptest.NewRecorder()
		router.ServeHTTP(wDetails, detailsReq)

		var tbl models.RestaurantTable
		_ = json.Unmarshal(wDetails.Body.Bytes(), &tbl)
		if tbl.Status != models.TableStatusOccupied {
			t.Fatalf("Expected table status to be OCCUPIED after session open, got %s", tbl.Status)
		}
		if tbl.CurrentSession == nil || tbl.CurrentSession.ID != sessionID {
			t.Fatalf("Expected CurrentSession to be populated with session %s", sessionID)
		}
	})

	// 9. Prevent Duplicate Open Session on Same Table
	t.Run("PreventDuplicateOpenSession", func(t *testing.T) {
		openPayload := models.OpenSessionRequest{
			Notes: "محاولة فتح جلسة ثانية لنفس الطاولة",
		}
		body, _ := json.Marshal(openPayload)
		req, _ := http.NewRequest("POST", fmt.Sprintf("/api/v1/tables/%s/sessions", createdTableID), bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusConflict {
			t.Fatalf("Expected 409 Conflict for duplicate session open, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 10. Place Customer Order for This Table (Links to Session & Verifies Active Order)
	var activeOrderID string
	t.Run("CreateCustomerOrderAndVerifySessionLink", func(t *testing.T) {
		orderPayload := models.CreateOrderRequest{
			RestaurantID: "rest-01",
			TableID:      createdTableID,
			TableToken:   createdTableToken,
			TableName:    testTableNumber,
			Items: []models.CreateOrderItemRequest{
				{
					ProductID: "prod-01",
					Quantity:  1,
					SelectedOptions: []models.CreateOrderItemOptionRequest{
						{GroupID: "opt-size-grill", OptionID: "size-half"},
					},
					Notes: "بدون طماطم",
				},
			},
			Notes: "طلب داخل الصالة",
		}
		body, _ := json.Marshal(orderPayload)
		req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("Expected 201 Created for order, got %d: %s", w.Code, w.Body.String())
		}

		var createdOrder models.Order
		if err := json.Unmarshal(w.Body.Bytes(), &createdOrder); err != nil {
			t.Fatalf("Failed to parse created order: %v", err)
		}
		if createdOrder.ID == "" {
			t.Fatalf("Expected order ID to be non-empty")
		}
		activeOrderID = createdOrder.ID

		// Verify order is linked to session
		if createdOrder.SessionID == nil || *createdOrder.SessionID != sessionID {
			t.Fatalf("Expected order SessionID to be %s, got %+v", sessionID, createdOrder.SessionID)
		}

		// Verify Active Order Endpoint
		activeReq, _ := http.NewRequest("GET", fmt.Sprintf("/api/v1/tables/%s/active-order", createdTableID), nil)
		activeReq.Header.Set("Authorization", "Bearer "+token)
		wActive := httptest.NewRecorder()
		router.ServeHTTP(wActive, activeReq)

		if wActive.Code != http.StatusOK {
			t.Fatalf("Expected 200 for active order, got %d: %s", wActive.Code, wActive.Body.String())
		}

		var fetchedOrder models.Order
		if err := json.Unmarshal(wActive.Body.Bytes(), &fetchedOrder); err != nil {
			t.Fatalf("Failed to parse active order: %v", err)
		}
		if fetchedOrder.ID != activeOrderID {
			t.Fatalf("Expected active order ID %s, got %s", activeOrderID, fetchedOrder.ID)
		}
	})

	// 11. Reject Session Closure While Active Orders Remain (Without Override)
	t.Run("RejectSessionClosureWithActiveOrders", func(t *testing.T) {
		closePayload := models.CloseSessionRequest{
			Override: false,
			Notes:    "محاولة إغلاق بدون إنهاء الطلب",
		}
		body, _ := json.Marshal(closePayload)
		url := fmt.Sprintf("/api/v1/tables/%s/sessions/%s/close", createdTableID, sessionID)
		req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusConflict {
			t.Fatalf("Expected 409 Conflict when closing session with active orders, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 12. Close Session with Authorized Override and Release Table to CLEANING
	t.Run("CloseSessionWithOverrideAndReleaseTable", func(t *testing.T) {
		closePayload := models.CloseSessionRequest{
			Override:     true,
			Notes:        "إغلاق مصرح بواسطة الإدارة",
			TargetStatus: "CLEANING",
		}
		body, _ := json.Marshal(closePayload)
		url := fmt.Sprintf("/api/v1/tables/%s/sessions/%s/close", createdTableID, sessionID)
		req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK for authorized session close, got %d: %s", w.Code, w.Body.String())
		}

		var closedSession models.TableSession
		if err := json.Unmarshal(w.Body.Bytes(), &closedSession); err != nil {
			t.Fatalf("Failed to parse closed session: %v", err)
		}
		if closedSession.Status != models.SessionStatusClosed {
			t.Fatalf("Expected session status to be CLOSED, got %s", closedSession.Status)
		}

		// Verify table status is now CLEANING
		detailsReq, _ := http.NewRequest("GET", "/api/v1/tables/"+createdTableID, nil)
		detailsReq.Header.Set("Authorization", "Bearer "+token)
		wDetails := httptest.NewRecorder()
		router.ServeHTTP(wDetails, detailsReq)

		var tbl models.RestaurantTable
		_ = json.Unmarshal(wDetails.Body.Bytes(), &tbl)
		if tbl.Status != models.TableStatusCleaning {
			t.Fatalf("Expected table status to be CLEANING after close, got %s", tbl.Status)
		}
		if tbl.CurrentSession != nil {
			t.Fatalf("Expected CurrentSession to be nil after closure, got %+v", tbl.CurrentSession)
		}
	})

	// 13. Release Table from CLEANING to AVAILABLE (after active order is completed/cancelled)
	t.Run("ReleaseTableToAvailable", func(t *testing.T) {
		// Cancel the order first so no active orders remain
		cancelPayload := models.CancelOrderRequest{
			Reason: "إلغاء الطلب لاختبار إخلاء الطاولة",
		}
		cancelBody, _ := json.Marshal(cancelPayload)
		cancelReq, _ := http.NewRequest("POST", "/api/v1/orders/"+activeOrderID+"/cancel", bytes.NewBuffer(cancelBody))
		cancelReq.Header.Set("Authorization", "Bearer "+token)
		cancelReq.Header.Set("Content-Type", "application/json")
		wCancel := httptest.NewRecorder()
		router.ServeHTTP(wCancel, cancelReq)
		if wCancel.Code != http.StatusOK {
			t.Fatalf("Failed to cancel order: %d %s", wCancel.Code, wCancel.Body.String())
		}

		availStatus := models.TableStatusAvailable
		updatePayload := models.UpdateTableRequest{
			Status: &availStatus,
		}
		body, _ := json.Marshal(updatePayload)
		req, _ := http.NewRequest("PATCH", "/api/v1/tables/"+createdTableID, bytes.NewBuffer(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}

		var tbl models.RestaurantTable
		_ = json.Unmarshal(w.Body.Bytes(), &tbl)
		if tbl.Status != models.TableStatusAvailable {
			t.Fatalf("Expected table status to be AVAILABLE, got %s", tbl.Status)
		}
	})
}
