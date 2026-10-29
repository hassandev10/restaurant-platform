package services

import (
	cryptorand "crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/google/uuid"

	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/realtime"
	"smart-restaurant-api/internal/repositories"
)

func generateSecureOpaqueToken() string {
	b := make([]byte, 24)
	if _, err := cryptorand.Read(b); err != nil {
		return fmt.Sprintf("tbl_%d_%s", time.Now().UnixNano(), uuid.New().String()[:12])
	}
	return "tbl_" + hex.EncodeToString(b)
}

type TableService struct {
	tableRepo       *repositories.TableRepository
	restaurantRepo  *repositories.RestaurantRepository
	orderRepo       *repositories.OrderRepository
	authService     *AuthService
	customerBaseURL string
	hub             *realtime.Hub
}

func NewTableService(
	tableRepo *repositories.TableRepository,
	restaurantRepo *repositories.RestaurantRepository,
	orderRepo *repositories.OrderRepository,
	authService *AuthService,
	customerBaseURL string,
	hub *realtime.Hub,
) *TableService {
	if customerBaseURL == "" {
		customerBaseURL = "http://localhost:3000"
	}
	return &TableService{
		tableRepo:       tableRepo,
		restaurantRepo:  restaurantRepo,
		orderRepo:       orderRepo,
		authService:     authService,
		customerBaseURL: strings.TrimRight(customerBaseURL, "/"),
		hub:             hub,
	}
}

func (s *TableService) ListTables(staff *Claims, filter models.TableFilterQuery) (*models.PaginatedTablesResponse, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح: يجب تسجيل الدخول كموظف مطعم")
	}

	branchID := staff.BranchID
	tables, total, err := s.tableRepo.ListTables(staff.RestaurantID, branchID, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to list tables: %w", err)
	}

	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	totalPages := (total + pageSize - 1) / pageSize
	if totalPages < 1 {
		totalPages = 1
	}

	return &models.PaginatedTablesResponse{
		Tables:     tables,
		Total:      total,
		Page:       filter.Page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

func (s *TableService) GetTableDetails(staff *Claims, tableID string) (*models.RestaurantTable, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح")
	}

	table, err := s.tableRepo.GetTableByID(staff.RestaurantID, tableID)
	if err != nil {
		return nil, fmt.Errorf("failed to get table details: %w", err)
	}
	if table == nil {
		return nil, errors.New("الطاولة غير موجودة")
	}
	return table, nil
}

func (s *TableService) CreateTable(staff *Claims, req models.CreateTableRequest) (*models.RestaurantTable, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح")
	}

	// Role permission check
	if staff.Role != "ADMIN" && staff.Role != "MANAGER" {
		return nil, errors.New("صلاحية غير كافية: إنشاء الطاولات متاح لمدير النظام أو مدير الصالة فقط")
	}

	if req.Capacity <= 0 {
		return nil, errors.New("سعة الطاولة يجب أن تكون رقم موجب أكبر من صفر")
	}

	// Verify uniqueness of table number in restaurant
	existing, err := s.tableRepo.GetTableByNumber(staff.RestaurantID, req.TableNumber)
	if err != nil {
		return nil, fmt.Errorf("error verifying table number: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("رقم الطاولة '%s' مسجل بالفعل في هذا المطعم", req.TableNumber)
	}

	displayName := req.DisplayName
	if displayName == "" {
		displayName = fmt.Sprintf("طاولة %s", req.TableNumber)
	}

	tableID := fmt.Sprintf("table-%s-%s", req.TableNumber, uuid.New().String()[:6])
	token := generateSecureOpaqueToken()

	branchID := req.BranchID
	if branchID == "" {
		branchID = staff.BranchID
	}

	var sectionIDPtr *string
	if req.SectionID != "" {
		sectionIDPtr = &req.SectionID
	}

	table := &models.RestaurantTable{
		ID:           tableID,
		RestaurantID: staff.RestaurantID,
		BranchID:     branchID,
		TableNumber:  req.TableNumber,
		DisplayName:  displayName,
		Name:         displayName,
		Capacity:     req.Capacity,
		SectionID:    sectionIDPtr,
		Token:        token,
		Status:       models.TableStatusAvailable,
		IsActive:     true,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}

	if err := s.tableRepo.CreateTable(table); err != nil {
		return nil, fmt.Errorf("failed to persist table: %w", err)
	}

	// Real-time event
	s.hub.BroadcastTableEvent(realtime.TableEvent{
		EventID:      uuid.New().String(),
		Type:         "table.created",
		RestaurantID: staff.RestaurantID,
		BranchID:     table.BranchID,
		TableID:      table.ID,
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
		Data:         table,
	})

	return table, nil
}

func (s *TableService) UpdateTable(staff *Claims, tableID string, req models.UpdateTableRequest) (*models.RestaurantTable, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح")
	}

	table, err := s.tableRepo.GetTableByID(staff.RestaurantID, tableID)
	if err != nil {
		return nil, err
	}
	if table == nil {
		return nil, errors.New("الطاولة غير موجودة")
	}

	if req.DisplayName != nil && *req.DisplayName != "" {
		table.DisplayName = *req.DisplayName
		table.Name = *req.DisplayName
	}

	if req.Capacity != nil {
		if *req.Capacity <= 0 {
			return nil, errors.New("سعة الطاولة يجب أن تكون أكبر من صفر")
		}
		table.Capacity = *req.Capacity
	}

	if req.SectionID != nil {
		if *req.SectionID == "" {
			table.SectionID = nil
		} else {
			table.SectionID = req.SectionID
		}
	}

	statusChanged := false
	if req.Status != nil && *req.Status != table.Status {
		newStatus := *req.Status

		// Validate operational status transition
		switch newStatus {
		case models.TableStatusAvailable:
			// Cannot mark AVAILABLE if active open session or active orders exist
			if table.CurrentSession != nil && table.CurrentSession.Status == models.SessionStatusOpen {
				return nil, errors.New("لا يمكن تحويل الطاولة إلى متاحة أثناء وجود جلسة مفتوحة. يجب إنهاء الجلسة أولاً")
			}
			if table.ActiveOrder != nil {
				return nil, errors.New("لا يمكن تحويل الطاولة إلى متاحة أثناء وجود طلبات نشطة")
			}
		case models.TableStatusOutOfService, models.TableStatusReserved, models.TableStatusCleaning:
			if table.CurrentSession != nil && table.CurrentSession.Status == models.SessionStatusOpen {
				return nil, fmt.Errorf("لا يمكن تحويل الطاولة إلى %s أثناء وجود جلسة مفتوحة للعملاء", newStatus)
			}
		case models.TableStatusOccupied:
			// Marked occupied automatically on session open or order
		default:
			return nil, fmt.Errorf("حالة طاولة غير صالحة: %s", newStatus)
		}

		table.Status = newStatus
		statusChanged = true
	}

	if err := s.tableRepo.UpdateTable(table); err != nil {
		return nil, fmt.Errorf("failed to update table: %w", err)
	}

	// Real-time events
	s.hub.BroadcastTableEvent(realtime.TableEvent{
		EventID:      uuid.New().String(),
		Type:         "table.updated",
		RestaurantID: staff.RestaurantID,
		BranchID:     table.BranchID,
		TableID:      table.ID,
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
		Data:         table,
	})

	if statusChanged {
		s.hub.BroadcastTableEvent(realtime.TableEvent{
			EventID:      uuid.New().String(),
			Type:         "table.occupancy.changed",
			RestaurantID: staff.RestaurantID,
			BranchID:     table.BranchID,
			TableID:      table.ID,
			Timestamp:    time.Now().UTC().Format(time.RFC3339),
			Data: ginMap{
				"status": table.Status,
			},
		})
	}

	return table, nil
}

func (s *TableService) OpenSession(staff *Claims, tableID string, req models.OpenSessionRequest) (*models.TableSession, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح")
	}

	tx, err := s.tableRepo.BeginTx()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Verify table exists
	table, err := s.tableRepo.GetTableByID(staff.RestaurantID, tableID)
	if err != nil || table == nil {
		return nil, errors.New("الطاولة غير موجودة أو لا تتبع هذا المطعم")
	}

	// Reject if table is out of service or cleaning
	if table.Status == models.TableStatusOutOfService {
		return nil, errors.New("لا يمكن فتح جلسة: الطاولة خارج الخدمة حالياً")
	}

	// Check if already open session exists (using row lock)
	existingSession, err := s.tableRepo.GetOpenSessionForTable(tx, tableID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing sessions: %w", err)
	}
	if existingSession != nil {
		return nil, errors.New("توجد جلسة مفتوحة بالفعل لهذه الطاولة")
	}

	sessionID := fmt.Sprintf("sess_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:6])
	session := &models.TableSession{
		ID:           sessionID,
		RestaurantID: staff.RestaurantID,
		BranchID:     table.BranchID,
		TableID:      tableID,
		OpenedBy:     staff.UserID,
		OpenedByName: staff.Name,
		OpenedAt:     time.Now().UTC(),
		Status:       models.SessionStatusOpen,
		Notes:        req.Notes,
	}

	// Create session
	if err := s.tableRepo.CreateSession(tx, session); err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	// Mark table OCCUPIED
	if err := s.tableRepo.UpdateTableStatus(tx, tableID, models.TableStatusOccupied); err != nil {
		return nil, fmt.Errorf("failed to update table status: %w", err)
	}

	// Link any pending active orders for this table to this session
	if err := s.tableRepo.LinkOrdersToSession(tx, tableID, session.ID); err != nil {
		return nil, fmt.Errorf("failed to link active orders to session: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit open session transaction: %w", err)
	}

	// Real-time events
	s.hub.BroadcastTableEvent(realtime.TableEvent{
		EventID:      uuid.New().String(),
		Type:         "table.session.opened",
		RestaurantID: staff.RestaurantID,
		BranchID:     table.BranchID,
		TableID:      tableID,
		SessionID:    session.ID,
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
		Data:         session,
	})

	s.hub.BroadcastTableEvent(realtime.TableEvent{
		EventID:      uuid.New().String(),
		Type:         "table.occupancy.changed",
		RestaurantID: staff.RestaurantID,
		BranchID:     table.BranchID,
		TableID:      tableID,
		SessionID:    session.ID,
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
		Data: ginMap{
			"status": models.TableStatusOccupied,
		},
	})

	return session, nil
}

func (s *TableService) CloseSession(staff *Claims, tableID, sessionID string, req models.CloseSessionRequest) (*models.TableSession, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح")
	}

	tx, err := s.tableRepo.BeginTx()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Verify table
	table, err := s.tableRepo.GetTableByID(staff.RestaurantID, tableID)
	if err != nil || table == nil {
		return nil, errors.New("الطاولة غير موجودة")
	}

	// Verify open session
	session, err := s.tableRepo.GetOpenSessionForTable(tx, tableID)
	if err != nil {
		return nil, fmt.Errorf("failed to find session: %w", err)
	}
	if session == nil || session.ID != sessionID {
		return nil, errors.New("الجلسة المحددة غير موجودة أو تم إغلاقها مسبقاً")
	}

	// Check linked active orders
	activeOrders, err := s.tableRepo.GetActiveOrdersForTable(tableID)
	if err != nil {
		return nil, fmt.Errorf("failed to check active orders: %w", err)
	}

	if len(activeOrders) > 0 {
		if !req.Override {
			return nil, fmt.Errorf("لا يمكن إنهاء الجلسة أثناء وجود %d طلبات قيد التحضير أو التقديم. يجب تقديم الطلبات أو إلغاؤها أولاً، أو استخدام إغلاق استثنائي مصرح", len(activeOrders))
		}
		// If override requested, check permissions
		if staff.Role != "ADMIN" && staff.Role != "MANAGER" {
			return nil, errors.New("صلاحية غير كافية: تجاوز إغلاق الجلسة مع طلبات نشطة يتطلب رتبة مدير")
		}
	}

	// Close session
	closeNotes := req.Notes
	if req.Override {
		closeNotes = fmt.Sprintf("[إغلاق استثنائي بواسطة %s]: %s", staff.Name, closeNotes)
	}

	if err := s.tableRepo.CloseSession(tx, sessionID, staff.UserID, closeNotes); err != nil {
		return nil, fmt.Errorf("failed to close session: %w", err)
	}

	// Release table: set status to CLEANING or AVAILABLE
	targetStatus := models.TableStatusCleaning
	if req.TargetStatus == "AVAILABLE" {
		targetStatus = models.TableStatusAvailable
	}

	if err := s.tableRepo.UpdateTableStatus(tx, tableID, targetStatus); err != nil {
		return nil, fmt.Errorf("failed to release table: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit close session: %w", err)
	}

	now := time.Now().UTC()
	session.ClosedAt = &now
	session.ClosedBy = staff.UserID
	session.ClosedByName = staff.Name
	session.Status = models.SessionStatusClosed
	session.DurationMinutes = int(now.Sub(session.OpenedAt).Minutes())

	// Real-time events
	s.hub.BroadcastTableEvent(realtime.TableEvent{
		EventID:      uuid.New().String(),
		Type:         "table.session.closed",
		RestaurantID: staff.RestaurantID,
		BranchID:     table.BranchID,
		TableID:      tableID,
		SessionID:    sessionID,
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
		Data:         session,
	})

	s.hub.BroadcastTableEvent(realtime.TableEvent{
		EventID:      uuid.New().String(),
		Type:         "table.occupancy.changed",
		RestaurantID: staff.RestaurantID,
		BranchID:     table.BranchID,
		TableID:      tableID,
		SessionID:    sessionID,
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
		Data: ginMap{
			"status": targetStatus,
		},
	})

	return session, nil
}

func (s *TableService) GetActiveOrder(staff *Claims, tableID string) (*models.Order, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح")
	}

	table, err := s.tableRepo.GetTableByID(staff.RestaurantID, tableID)
	if err != nil || table == nil {
		return nil, errors.New("الطاولة غير موجودة")
	}

	activeOrders, err := s.tableRepo.GetActiveOrdersForTable(tableID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch active orders: %w", err)
	}

	if len(activeOrders) == 0 {
		return nil, nil
	}

	// Return the oldest active order
	return s.orderRepo.GetOrderByID(activeOrders[0].ID)
}

func (s *TableService) CloseSessionDirect(staff *Claims, sessionID string, req models.CloseSessionRequest) (*models.TableSession, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح: يجب تسجيل الدخول كمسؤول")
	}

	session, err := s.tableRepo.GetSessionByID(staff.RestaurantID, sessionID)
	if err != nil {
		return nil, fmt.Errorf("خطأ أثناء البحث عن الجلسة: %w", err)
	}
	if session == nil {
		return nil, errors.New("الجلسة غير موجودة أو تابعة لمطعم آخر")
	}

	return s.CloseSession(staff, session.TableID, sessionID, req)
}

func (s *TableService) GetTableSession(staff *Claims, tableID string) (*models.TableSession, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح: يجب تسجيل الدخول كمسؤول")
	}

	// Verify table belongs to restaurant
	table, err := s.tableRepo.GetTableByID(staff.RestaurantID, tableID)
	if err != nil || table == nil {
		return nil, errors.New("الطاولة غير موجودة")
	}

	session, err := s.tableRepo.GetOpenSessionForTableDetails(staff.RestaurantID, tableID)
	if err != nil {
		return nil, fmt.Errorf("خطأ أثناء استرجاع جلسة الطاولة: %w", err)
	}
	if session == nil {
		return nil, errors.New("لا توجد جلسة نشطة لهذه الطاولة حالياً")
	}

	return session, nil
}

func (s *TableService) GetSessionDetails(staff *Claims, sessionID string) (*models.TableSession, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح: يجب تسجيل الدخول كمسؤول")
	}

	session, err := s.tableRepo.GetSessionByID(staff.RestaurantID, sessionID)
	if err != nil {
		return nil, fmt.Errorf("خطأ أثناء استرجاع بيانات الجلسة: %w", err)
	}
	if session == nil {
		return nil, errors.New("الجلسة غير موجودة أو تابعة لمطعم آخر")
	}

	return session, nil
}

func (s *TableService) GetSessionOrders(staff *Claims, sessionID string) ([]models.Order, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح: يجب تسجيل الدخول كمسؤول")
	}

	// First verify session belongs to restaurant
	session, err := s.tableRepo.GetSessionByID(staff.RestaurantID, sessionID)
	if err != nil {
		return nil, fmt.Errorf("خطأ أثناء التحقق من الجلسة: %w", err)
	}
	if session == nil {
		return nil, errors.New("الجلسة غير موجودة أو تابعة لمطعم آخر")
	}

	return s.tableRepo.GetSessionOrders(sessionID)
}

func (s *TableService) ListSections(staff *Claims) ([]models.TableSection, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح")
	}
	return s.tableRepo.ListSections(staff.RestaurantID)
}

func (s *TableService) CreateSection(staff *Claims, req models.CreateSectionRequest) (*models.TableSection, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح")
	}
	if staff.Role != "ADMIN" && staff.Role != "MANAGER" {
		return nil, errors.New("صلاحية غير كافية: إنشاء الأقسام متاح للمديرين فقط")
	}

	sectionID := fmt.Sprintf("sec_%d_%d", time.Now().UnixMilli(), rand.Intn(999))
	branchID := req.BranchID
	if branchID == "" {
		branchID = staff.BranchID
	}

	section := &models.TableSection{
		ID:           sectionID,
		RestaurantID: staff.RestaurantID,
		BranchID:     branchID,
		Name:         req.Name,
		DisplayOrder: req.DisplayOrder,
		CreatedAt:    time.Now().UTC(),
	}

	if err := s.tableRepo.CreateSection(section); err != nil {
		return nil, fmt.Errorf("failed to create section: %w", err)
	}

	return section, nil
}

func (s *TableService) getCustomerBaseURL() string {
	if s.customerBaseURL != "" {
		return s.customerBaseURL
	}
	return "http://localhost:3000"
}

func (s *TableService) ValidateTableForCustomer(restaurantSlug, tableNumber string) (*models.TableValidationResponse, error) {
	normTableNum := strings.TrimSpace(tableNumber)
	if normTableNum == "" {
		return nil, errors.New("يجب إدخال رقم الطاولة")
	}

	// 1. Validate restaurant exists and is active
	restaurant, err := s.restaurantRepo.GetRestaurantBySlug(restaurantSlug)
	if err != nil {
		return nil, fmt.Errorf("خطأ في استعلام المطعم: %w", err)
	}
	if restaurant == nil || !restaurant.IsOpen {
		return nil, errors.New("المطعم غير موجود أو غير متاح حالياً")
	}

	// 2. Find table in restaurant by table number
	table, err := s.tableRepo.GetTableByNumber(restaurant.ID, normTableNum)
	if err != nil {
		return nil, fmt.Errorf("خطأ في التحقق من الطاولة: %w", err)
	}
	if table == nil {
		return nil, fmt.Errorf("رقم الطاولة '%s' غير موجود في هذا المطعم", normTableNum)
	}

	// 3. Check if table is disabled
	if !table.IsActive {
		return nil, errors.New("هذه الطاولة معطلة حالياً، يرجى مراجعة موظف الاستقبال")
	}

	// 4. Check operational status
	switch table.Status {
	case models.TableStatusOutOfService:
		return nil, errors.New("هذه الطاولة خارج الخدمة حالياً")
	case models.TableStatusCleaning:
		return nil, errors.New("الطاولة قيد التنظيف والتعقيم حالياً، يرجى الانتظار لحظات")
	}

	// 5. Occupied table behavior: seated guests can join the active session and add orders
	canOrder := true
	var sessionIDStr *string
	if table.CurrentSession != nil && table.CurrentSession.Status == models.SessionStatusOpen {
		sessionIDStr = &table.CurrentSession.ID
	}

	// 6. Generate signed cryptographic table context token
	sessIDVal := ""
	if sessionIDStr != nil {
		sessIDVal = *sessionIDStr
	}
	contextToken, expiresAt, err := s.authService.GenerateTableContextToken(table, restaurant, sessIDVal)
	if err != nil {
		return nil, fmt.Errorf("فشل في إنشاء رمز سياق الطاولة: %w", err)
	}

	// 7. Format customer URLs
	customerBaseURL := s.getCustomerBaseURL()
	customerURL := fmt.Sprintf("%s/r/%s/t/%s", customerBaseURL, restaurant.Slug, table.Token)
	shortCustomerURL := fmt.Sprintf("%s/t/%s", customerBaseURL, table.Token)

	return &models.TableValidationResponse{
		Success: true,
		Restaurant: models.RestaurantPublicInfo{
			Name:        restaurant.Name,
			Slug:        restaurant.Slug,
			Currency:    restaurant.Currency,
			LogoURL:     restaurant.LogoURL,
			Description: restaurant.Description,
		},
		Table: models.TablePublicInfo{
			TableNumber: table.TableNumber,
			DisplayName: table.DisplayName,
			Capacity:    table.Capacity,
			SectionName: table.SectionName,
			Status:      table.Status,
		},
		TableContextToken: contextToken,
		TableToken:        table.Token,
		CustomerURL:       customerURL,
		ShortCustomerURL:  shortCustomerURL,
		CanOrder:          canOrder,
		SessionID:         sessionIDStr,
		ExpiresAt:         expiresAt.Format(time.RFC3339),
		Message:           "تم التحقق من الطاولة بنجاح، يمكنك تصفح القائمة وإرسال طلبك",
	}, nil
}

func (s *TableService) GetTableQRDetails(staff *Claims, tableID string) (*models.TableQRResponse, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح: يجب تسجيل الدخول")
	}

	table, err := s.tableRepo.GetTableByID(staff.RestaurantID, tableID)
	if err != nil || table == nil {
		return nil, errors.New("الطاولة غير موجودة")
	}

	restaurant, err := s.restaurantRepo.GetRestaurantByID(table.RestaurantID)
	if err != nil || restaurant == nil {
		return nil, errors.New("المطعم غير موجود")
	}

	customerBaseURL := s.getCustomerBaseURL()
	customerURL := fmt.Sprintf("%s/r/%s/t/%s", customerBaseURL, restaurant.Slug, table.Token)
	shortCustomerURL := fmt.Sprintf("%s/t/%s", customerBaseURL, table.Token)

	branchName := "الفرع الرئيسي"
	if table.BranchID != "" {
		branch, _ := s.restaurantRepo.GetBranchByID(table.BranchID)
		if branch != nil {
			branchName = branch.Name
		}
	}

	return &models.TableQRResponse{
		TableID:          table.ID,
		TableNumber:      table.TableNumber,
		DisplayName:      table.DisplayName,
		SectionName:      table.SectionName,
		Token:            table.Token,
		CustomerURL:      customerURL,
		ShortCustomerURL: shortCustomerURL,
		RestaurantName:   restaurant.Name,
		RestaurantSlug:   restaurant.Slug,
		BranchName:       branchName,
		GeneratedAt:      time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func (s *TableService) RegenerateTableQR(staff *Claims, tableID string) (*models.TableQRResponse, error) {
	if staff == nil || staff.RestaurantID == "" {
		return nil, errors.New("غير مصرح: يجب تسجيل الدخول")
	}
	if staff.Role != "ADMIN" && staff.Role != "MANAGER" {
		return nil, errors.New("صلاحية غير كافية: إعادة توليد رمز QR متاح للمديرين فقط")
	}

	table, err := s.tableRepo.GetTableByID(staff.RestaurantID, tableID)
	if err != nil || table == nil {
		return nil, errors.New("الطاولة غير موجودة")
	}

	newToken := generateSecureOpaqueToken()
	if err := s.tableRepo.RegenerateTableToken(table.ID, newToken); err != nil {
		return nil, fmt.Errorf("فشل في تحديث رمز QR: %w", err)
	}

	table.Token = newToken
	return s.GetTableQRDetails(staff, tableID)
}

func (s *TableService) ResolvePublicQR(token string) (*models.TableValidationResponse, error) {
	normToken := strings.TrimSpace(token)
	if normToken == "" {
		return nil, errors.New("رمز QR مطلوب")
	}

	table, err := s.tableRepo.GetTableByTokenGlobal(normToken)
	if err != nil || table == nil {
		return nil, errors.New("رمز QR غير صالح أو غير مسجل")
	}

	restaurant, err := s.restaurantRepo.GetRestaurantByID(table.RestaurantID)
	if err != nil || restaurant == nil {
		return nil, errors.New("المطعم غير موجود")
	}

	return s.ValidateTableForCustomer(restaurant.Slug, table.TableNumber)
}

func (s *TableService) ToggleTableActive(staff *Claims, tableID string, isActive bool) error {
	if staff == nil || staff.RestaurantID == "" {
		return errors.New("غير مصرح: يجب تسجيل الدخول")
	}
	if staff.Role != "ADMIN" && staff.Role != "MANAGER" && staff.Role != "OWNER" {
		return errors.New("صلاحية غير كافية: تعديل حالة تفعيل الطاولة يتطلب صلاحية مسؤول")
	}

	return s.tableRepo.ToggleTableActive(staff.RestaurantID, tableID, isActive)
}

func (s *TableService) DeleteTable(staff *Claims, tableID string) error {
	if staff == nil || staff.RestaurantID == "" {
		return errors.New("غير مصرح: يجب تسجيل الدخول")
	}
	if staff.Role != "ADMIN" && staff.Role != "MANAGER" && staff.Role != "OWNER" {
		return errors.New("صلاحية غير كافية: حذف الطاولة يتطلب صلاحية مسؤول")
	}

	return s.tableRepo.DeleteTable(staff.RestaurantID, tableID)
}

type ginMap map[string]interface{}

