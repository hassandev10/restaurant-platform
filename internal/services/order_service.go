package services

import (
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"

	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/realtime"
	"smart-restaurant-api/internal/repositories"
)

type OrderService struct {
	orderRepo        *repositories.OrderRepository
	restaurantRepo   *repositories.RestaurantRepository
	menuRepo         *repositories.MenuRepository
	tableRepo        *repositories.TableRepository
	inventoryService *InventoryService
	authService      *AuthService
	hub              *realtime.Hub
}

func NewOrderService(
	orderRepo *repositories.OrderRepository,
	restaurantRepo *repositories.RestaurantRepository,
	menuRepo *repositories.MenuRepository,
	tableRepo *repositories.TableRepository,
	authService *AuthService,
	hub *realtime.Hub,
) *OrderService {
	return &OrderService{
		orderRepo:      orderRepo,
		restaurantRepo: restaurantRepo,
		menuRepo:       menuRepo,
		tableRepo:      tableRepo,
		authService:    authService,
		hub:            hub,
	}
}

func (s *OrderService) SetInventoryService(inventoryService *InventoryService) {
	s.inventoryService = inventoryService
}

func (s *OrderService) GetActiveOrders(restaurantID string) ([]models.Order, error) {
	return s.orderRepo.GetActiveOrders(restaurantID)
}

func (s *OrderService) GetHistoricalOrders(restaurantID string) ([]models.Order, error) {
	return s.orderRepo.GetHistoricalOrders(restaurantID)
}

func (s *OrderService) GetOrderByID(orderID string) (*models.Order, error) {
	return s.orderRepo.GetOrderByID(orderID)
}

func (s *OrderService) GetOrderEvents(orderID string) ([]models.OrderEvent, error) {
	return s.orderRepo.GetOrderEvents(orderID)
}

func (s *OrderService) CreateOrder(req models.CreateOrderRequest) (*models.Order, error) {
	// Determine and normalize OrderType
	orderType := req.OrderType
	if orderType == "" {
		// Infer DINE_IN if table context or token is present, otherwise require explicit context
		if req.TableContextToken != "" || req.TableToken != "" || (req.TableID != "" && req.TableID != "unassigned") {
			orderType = models.OrderTypeDineIn
		} else {
			return nil, errors.New("رمز سياق الطاولة مطلوب لإتمام الطلب: يرجى مسح رمز QR أو تحديد نوع الطلب سفري (TAKEAWAY)")
		}
	}

	var authoritativeTable *models.RestaurantTable
	var authoritativeRestaurant *models.Restaurant
	var sessionIDFromContext *string

	switch orderType {
	case models.OrderTypeTakeaway:
		// 1. Consistency check: TAKEAWAY orders cannot be bound to a table or table context token
		if req.TableContextToken != "" || req.TableToken != "" || (req.TableID != "" && req.TableID != "unassigned") {
			return nil, errors.New("تضارب في سياق الطلب: طلبات السفري (TAKEAWAY) لا ترتبط بطاولة أو جلسة صالة")
		}

		// 2. Resolve Restaurant
		if req.RestaurantID == "" {
			return nil, errors.New("معرف المطعم مطلوب لإتمام الطلب السفري")
		}

		rest, err := s.restaurantRepo.GetRestaurantByID(req.RestaurantID)
		if err != nil || rest == nil {
			rest, err = s.restaurantRepo.GetRestaurantBySlug(req.RestaurantID)
		}
		if err != nil || rest == nil {
			return nil, errors.New("المطعم المحدد غير موجود أو غير متاح")
		}
		authoritativeRestaurant = rest

	case models.OrderTypeDineIn:
		// 1. Mandatory Table Context Verification
		if req.TableContextToken != "" {
			claims, err := s.authService.ValidateTableContextToken(req.TableContextToken)
			if err != nil {
				return nil, fmt.Errorf("رمز سياق الطاولة غير صالح أو منتهي الصلاحية: %w", err)
			}

			// Ensure token belongs to the restaurant if specified in request
			if req.RestaurantID != "" && claims.RestaurantID != req.RestaurantID && claims.RestaurantSlug != req.RestaurantID {
				return nil, errors.New("سياق الطاولة غير صالح لهذا المطعم: تضارب في هوية المطعم")
			}

			// Check client tampering: if client sent tableId in body, it MUST match claims.TableID
			if req.TableID != "" && req.TableID != claims.TableID {
				return nil, errors.New("محاولة تلاعب: معرف الطاولة المرسل لا يتطابق مع سياق الطاولة المعتمد")
			}

			// Fetch authoritative table from DB
			tbl, err := s.tableRepo.GetTableByID(claims.RestaurantID, claims.TableID)
			if err != nil || tbl == nil {
				return nil, errors.New("الطاولة المرتبطة برمز السياق لم تعد موجودة")
			}
			authoritativeTable = tbl

			rest, err := s.restaurantRepo.GetRestaurantByID(claims.RestaurantID)
			if err != nil || rest == nil {
				return nil, errors.New("المطعم المرتبط برمز السياق غير موجود")
			}
			authoritativeRestaurant = rest

			if claims.SessionID != "" {
				sessID := claims.SessionID
				sessionIDFromContext = &sessID
			}
		} else if req.TableToken != "" {
			// Validated via global QR token
			tbl, err := s.tableRepo.GetTableByTokenGlobal(req.TableToken)
			if err != nil || tbl == nil {
				return nil, errors.New("رمز QR للطاولة غير صالح أو غير موجود")
			}

			if req.RestaurantID != "" && req.RestaurantID != tbl.RestaurantID {
				return nil, errors.New("سياق الطاولة غير صالح لهذا المطعم")
			}

			if req.TableID != "" && req.TableID != tbl.ID {
				return nil, errors.New("محاولة تلاعب: معرف الطاولة المرسل لا يتطابق مع سياق الطاولة المعتمد")
			}

			authoritativeTable = tbl

			rest, err := s.restaurantRepo.GetRestaurantByID(tbl.RestaurantID)
			if err != nil || rest == nil {
				return nil, errors.New("المطعم المرتبط برمز QR غير موجود")
			}
			authoritativeRestaurant = rest
		} else {
			// Context is mandatory!
			return nil, errors.New("رمز سياق الطاولة مطلوب لإتمام الطلب: يرجى التحقق من رقم الطاولة أو مسح رمز QR أولاً")
		}

		// Validate Table Eligibility
		if !authoritativeTable.IsActive {
			return nil, errors.New("هذه الطاولة معطلة حالياً ولا يمكن قبول طلبات جديدة")
		}
		if authoritativeTable.Status == models.TableStatusOutOfService {
			return nil, errors.New("الطاولة خارج الخدمة حالياً ولا يمكن استقبال طلبات منها")
		}
		if authoritativeTable.Status == models.TableStatusCleaning {
			return nil, errors.New("الطاولة قيد التنظيف والتعقيم حالياً، يرجى الانتظار لحظات")
		}

	default:
		return nil, fmt.Errorf("نوع الطلب '%s' غير مدعوم. الأنواع المدعومة: DINE_IN و TAKEAWAY", orderType)
	}

	// 2. Validate Restaurant Open Status
	if !authoritativeRestaurant.IsOpen {
		return nil, errors.New("المطعم مغلق حالياً، لا يمكن إرسال طلبات")
	}

	rest := authoritativeRestaurant
	table := authoritativeTable

	// 3. Process items with authoritative DB lookup & price recalculation
	var orderItems []models.OrderItem
	var calculatedSubtotal float64

	for idx, itemReq := range req.Items {
		if itemReq.Quantity <= 0 {
			return nil, fmt.Errorf("كمية العنصر رقم %d يجب أن تكون أكبر من صفر", idx+1)
		}

		product, err := s.menuRepo.GetProductByID(itemReq.ProductID)
		if err != nil {
			return nil, fmt.Errorf("خطأ في استرجاع المنتج: %w", err)
		}
		if product == nil || product.RestaurantID != rest.ID {
			return nil, fmt.Errorf("المنتج المحدد رقم %d غير موجود في قائمة المطعم", idx+1)
		}
		if !product.IsAvailable {
			return nil, fmt.Errorf("المنتج '%s' غير متوفر حالياً", product.NameAr)
		}

		// Build map of groups for this product
		groupMap := make(map[string]models.ProductOptionGroup)
		for _, g := range product.Options {
			groupMap[g.ID] = g
		}

		// Count selections per group
		selectionsPerGroup := make(map[string][]models.CreateOrderItemOptionRequest)
		for _, optReq := range itemReq.SelectedOptions {
			selectionsPerGroup[optReq.GroupID] = append(selectionsPerGroup[optReq.GroupID], optReq)
		}

		// Validate group constraints
		for _, group := range product.Options {
			selected := selectionsPerGroup[group.ID]
			count := len(selected)

			if group.IsRequired && count == 0 {
				return nil, fmt.Errorf("يجب اختيار صنف من مجموعة '%s' للمنتج '%s'", group.NameAr, product.NameAr)
			}
			if group.SelectionType == "SINGLE" && count > 1 {
				return nil, fmt.Errorf("مجموعة '%s' تسمح باختيار صنف واحد فقط", group.NameAr)
			}
			if group.MinSelections != nil && count < *group.MinSelections {
				return nil, fmt.Errorf("الحد الأدنى للاختيار من '%s' هو %d", group.NameAr, *group.MinSelections)
			}
			if group.MaxSelections != nil && count > *group.MaxSelections {
				return nil, fmt.Errorf("تجاوزت الحد الأقصى للاختيار من '%s' (%d)", group.NameAr, *group.MaxSelections)
			}
		}

		// Process and snapshot options
		var selectedSnapshots []models.SelectedOptionSnapshot
		var optionsDeltaSum float64

		for _, optReq := range itemReq.SelectedOptions {
			group, exists := groupMap[optReq.GroupID]
			if !exists {
				return nil, fmt.Errorf("مجموعة الخيارات '%s' غير صالحة للمنتج '%s'", optReq.GroupID, product.NameAr)
			}

			// Find option within group
			var matchedOption *models.ProductOption
			for _, o := range group.Options {
				if o.ID == optReq.OptionID {
					matchedOption = &o
					break
				}
			}

			if matchedOption == nil {
				return nil, fmt.Errorf("الخيار المحدد '%s' غير صالح في مجموعة '%s'", optReq.OptionID, group.NameAr)
			}
			if !matchedOption.IsAvailable {
				return nil, fmt.Errorf("الخيار '%s' غير متوفر حالياً", matchedOption.NameAr)
			}

			selectedSnapshots = append(selectedSnapshots, models.SelectedOptionSnapshot{
				GroupID:      group.ID,
				GroupNameAr:  group.NameAr,
				OptionID:     matchedOption.ID,
				OptionNameAr: matchedOption.NameAr,
				PriceDelta:   matchedOption.PriceDelta,
			})
			optionsDeltaSum += matchedOption.PriceDelta
		}

		unitPrice := product.Price + optionsDeltaSum
		lineTotal := unitPrice * float64(itemReq.Quantity)
		calculatedSubtotal += lineTotal

		itemID := fmt.Sprintf("item_%s_%d", uuid.New().String()[:8], idx+1)
		orderItems = append(orderItems, models.OrderItem{
			ID:                  itemID,
			ProductID:           product.ID,
			ProductNameSnapshot: product.NameAr,
			UnitPriceSnapshot:   unitPrice,
			Quantity:            itemReq.Quantity,
			SelectedOptions:     selectedSnapshots,
			Notes:               itemReq.Notes,
			LineTotal:           lineTotal,
		})
	}

	var tableName string
	var branchID string
	if orderType == models.OrderTypeTakeaway {
		tableName = "طلب سفري"
		if req.TableName != "" {
			tableName = req.TableName
		} else if req.TableNameSnapshot != "" {
			tableName = req.TableNameSnapshot
		}
		branchID = req.BranchID
	} else {
		tableName = table.Name
		if req.TableName != "" {
			tableName = req.TableName
		} else if req.TableNameSnapshot != "" {
			tableName = req.TableNameSnapshot
		}
		branchID = table.BranchID
	}

	// 4. Begin transaction for atomic session resolution and order creation
	tx, err := s.orderRepo.BeginTx()
	if err != nil {
		return nil, fmt.Errorf("failed to begin order transaction: %w", err)
	}
	defer tx.Rollback()

	var activeSession *models.TableSession
	var isNewSession bool
	var sessionID *string

	if orderType == models.OrderTypeDineIn {
		// Atomically resolve or open dining session for this table (with row lock & partial unique index guard)
		if s.tableRepo != nil {
			sess, isNew, sessErr := s.tableRepo.GetOrCreateOpenSessionTx(tx, rest.ID, table.BranchID, table.ID)
			if sessErr != nil {
				return nil, fmt.Errorf("failed to resolve active table session: %w", sessErr)
			}
			activeSession = sess
			isNewSession = isNew
		}

		if activeSession != nil {
			sessionID = &activeSession.ID
		} else if sessionIDFromContext != nil {
			sessionID = sessionIDFromContext
		}

		// Additional Orders Policy for DINE_IN:
		// - If the latest order in this active session is NEW and not forced into a separate ticket, append new items to it.
		// - If the order is CONFIRMED, PREPARING, READY, SERVED (or all orders CANCELLED), create a separate new order.
		var existingEligibleOrder *models.Order
		if !req.ForceNewOrder && activeSession != nil {
			latestOrder, err := s.orderRepo.GetLatestOrderForSessionTx(tx, activeSession.ID)
			if err == nil && latestOrder != nil && latestOrder.Status == models.StatusNew {
				existingEligibleOrder = latestOrder
			}
		}

		if existingEligibleOrder != nil {
			// Append items to eligible NEW order
			modEvent := models.OrderEvent{
				ID:        fmt.Sprintf("ev_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:4]),
				Timestamp: time.Now().UTC().Format(time.RFC3339),
				Status:    models.StatusNew,
				Actor:     fmt.Sprintf("العميل (عبر QR %s)", tableName),
				Note:      fmt.Sprintf("إضافة %d أصناف إضافية للطلب بقيمة %.2f %s", len(orderItems), calculatedSubtotal, rest.Currency),
			}

			if err := s.orderRepo.AppendItemsToOrderTx(tx, existingEligibleOrder.ID, orderItems, calculatedSubtotal, modEvent); err != nil {
				return nil, fmt.Errorf("failed to append items to order: %w", err)
			}

			if err := tx.Commit(); err != nil {
				return nil, fmt.Errorf("failed to commit order modification: %w", err)
			}

			// Fetch full updated order with batch items and options snapshots
			updatedOrder, err := s.orderRepo.GetOrderByID(existingEligibleOrder.ID)
			if err != nil {
				return nil, fmt.Errorf("failed to retrieve updated order: %w", err)
			}

			// Broadcast order updated real-time events
			s.hub.BroadcastTableEvent(realtime.TableEvent{
				EventID:      uuid.New().String(),
				Type:         "table.order.item_added",
				RestaurantID: rest.ID,
				BranchID:     table.BranchID,
				TableID:      table.ID,
				OrderID:      updatedOrder.ID,
				SessionID:    activeSession.ID,
				Timestamp:    time.Now().UTC().Format(time.RFC3339),
				Data: ginMap{
					"orderNumber":        updatedOrder.OrderNumber,
					"newItemsCount":      len(orderItems),
					"additionalSubtotal": calculatedSubtotal,
					"newTotal":           updatedOrder.Total,
				},
			})

			s.hub.Broadcast(realtime.OrderSubscriptionEvent{
				Type:         realtime.EventUpdated,
				Order:        *updatedOrder,
				Timestamp:    time.Now().UTC().Format(time.RFC3339),
				RestaurantID: rest.ID,
			})

			return updatedOrder, nil
		}
	}

	// 5. Create brand new order ticket
	orderID := fmt.Sprintf("ord_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:6])
	orderNumber := fmt.Sprintf("EG-%04d", rand.Intn(9000)+1000)

	var actorName string
	var initialNote string
	var tableID string

	if orderType == models.OrderTypeTakeaway {
		actorName = "العميل (طلب سفري)"
		initialNote = "تم استلام طلب سفري جديد بانتظار تأكيد مشرف الصالة"
		tableID = ""
	} else {
		actorName = fmt.Sprintf("العميل (عبر QR %s)", tableName)
		initialNote = fmt.Sprintf("تم استلام الطلب من %s بانتظار تأكيد مشرف الصالة", tableName)
		tableID = table.ID
	}

	initialEvent := models.OrderEvent{
		ID:        fmt.Sprintf("ev_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:4]),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Status:    models.StatusNew,
		Actor:     actorName,
		Note:      initialNote,
	}

	order := &models.Order{
		ID:                orderID,
		OrderNumber:       orderNumber,
		OrderType:         orderType,
		RestaurantID:      rest.ID,
		BranchID:          branchID,
		TableID:           tableID,
		TableName:         tableName,
		TableNameSnapshot: tableName,
		SessionID:         sessionID,
		Status:            models.StatusNew,
		Items:             orderItems,
		Subtotal:          calculatedSubtotal,
		Total:             calculatedSubtotal,
		PaymentStatus:     models.PaymentPending,
		CreatedAt:         time.Now().UTC().Format(time.RFC3339),
		UpdatedAt:         time.Now().UTC().Format(time.RFC3339),
		Events:            []models.OrderEvent{initialEvent},
	}

	if err := s.orderRepo.CreateOrderTx(tx, order); err != nil {
		return nil, fmt.Errorf("failed to save order: %w", err)
	}

	// Mark table as OCCUPIED in database only for DINE_IN
	if orderType == models.OrderTypeDineIn && s.tableRepo != nil {
		_ = s.tableRepo.UpdateTableStatus(tx, table.ID, models.TableStatusOccupied)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit order transaction: %w", err)
	}

	// Real-time events after transaction commits safely
	if orderType == models.OrderTypeDineIn && s.tableRepo != nil {
		if isNewSession && activeSession != nil {
			s.hub.BroadcastTableEvent(realtime.TableEvent{
				EventID:      uuid.New().String(),
				Type:         "table.session.opened",
				RestaurantID: rest.ID,
				BranchID:     table.BranchID,
				TableID:      table.ID,
				SessionID:    activeSession.ID,
				Timestamp:    time.Now().UTC().Format(time.RFC3339),
				Data:         activeSession,
			})
		}

		s.hub.BroadcastTableEvent(realtime.TableEvent{
			EventID:      uuid.New().String(),
			Type:         "order.assigned_to_table",
			RestaurantID: rest.ID,
			BranchID:     table.BranchID,
			TableID:      table.ID,
			OrderID:      order.ID,
			Timestamp:    time.Now().UTC().Format(time.RFC3339),
			Data: ginMap{
				"orderNumber": order.OrderNumber,
				"total":       order.Total,
			},
		})
		s.hub.BroadcastTableEvent(realtime.TableEvent{
			EventID:      uuid.New().String(),
			Type:         "table.occupancy.changed",
			RestaurantID: rest.ID,
			BranchID:     table.BranchID,
			TableID:      table.ID,
			Timestamp:    time.Now().UTC().Format(time.RFC3339),
			Data: ginMap{
				"status": models.TableStatusOccupied,
			},
		})
	}

	s.hub.Broadcast(realtime.OrderSubscriptionEvent{
		Type:         realtime.EventCreated,
		Order:        *order,
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
		RestaurantID: rest.ID,
	})

	return order, nil
}

func (s *OrderService) UpdateOrderStatus(orderID string, newStatus models.OrderStatus, actor, note string) (*models.Order, error) {
	return s.UpdateOrderStatusWithOptions(orderID, newStatus, "", actor, "", note, false, "")
}

func (s *OrderService) UpdateOrderStatusWithOptions(
	orderID string,
	newStatus models.OrderStatus,
	actorID, actor, actorRole, note string,
	allowOverride bool,
	overrideReason string,
) (*models.Order, error) {
	order, err := s.orderRepo.GetOrderByID(orderID)
	if err != nil {
		return nil, fmt.Errorf("error finding order: %w", err)
	}
	if order == nil {
		return nil, errors.New("الطلب غير موجود")
	}

	// Validate state machine transition
	if !CanTransitionStatus(order.Status, newStatus) {
		return nil, fmt.Errorf("انتقال غير قانوني للحالة: لا يمكن الانتقال من %s إلى %s", order.Status, newStatus)
	}

	paymentStatus := order.PaymentStatus
	if newStatus == models.StatusServed {
		paymentStatus = models.PaymentPaid
	}

	if actor == "" {
		actor = "الكابتن أحمد (مشرف الصالة)"
	}

	eventID := fmt.Sprintf("ev_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:4])

	// If transitioning to PREPARING and inventory tracking is active, atomically deduct stock
	if newStatus == models.StatusPreparing && s.inventoryService != nil {
		tx, err := s.orderRepo.BeginTx()
		if err != nil {
			return nil, fmt.Errorf("failed to begin order status transaction: %w", err)
		}
		defer tx.Rollback()

		if err := s.inventoryService.DeductStockForOrderTx(tx, order, actorID, actor, actorRole, allowOverride, overrideReason); err != nil {
			return nil, err
		}

		if err := s.orderRepo.UpdateOrderStatusTx(tx, orderID, newStatus, paymentStatus, actor, note, eventID); err != nil {
			return nil, fmt.Errorf("failed to update order status: %w", err)
		}

		if err := tx.Commit(); err != nil {
			return nil, fmt.Errorf("failed to commit status update transaction: %w", err)
		}
	} else {
		if err := s.orderRepo.UpdateOrderStatus(orderID, newStatus, paymentStatus, actor, note, eventID); err != nil {
			return nil, fmt.Errorf("failed to update order status: %w", err)
		}
	}

	updatedOrder, err := s.orderRepo.GetOrderByID(orderID)
	if err != nil || updatedOrder == nil {
		return nil, fmt.Errorf("failed to fetch updated order: %w", err)
	}

	// Broadcast update event
	s.hub.Broadcast(realtime.OrderSubscriptionEvent{
		Type:         realtime.EventUpdated,
		Order:        *updatedOrder,
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
		RestaurantID: updatedOrder.RestaurantID,
	})

	// Table lifecycle event on completed
	if newStatus == models.StatusServed && updatedOrder.TableID != "" {
		s.hub.BroadcastTableEvent(realtime.TableEvent{
			EventID:      uuid.New().String(),
			Type:         "order.completed",
			RestaurantID: updatedOrder.RestaurantID,
			BranchID:     updatedOrder.BranchID,
			TableID:      updatedOrder.TableID,
			OrderID:      updatedOrder.ID,
			Timestamp:    time.Now().UTC().Format(time.RFC3339),
			Data: ginMap{
				"orderNumber": updatedOrder.OrderNumber,
				"status":      updatedOrder.Status,
			},
		})
	}

	return updatedOrder, nil
}

func (s *OrderService) CancelOrder(orderID string, reason, actor string) (*models.Order, error) {
	order, err := s.orderRepo.GetOrderByID(orderID)
	if err != nil {
		return nil, fmt.Errorf("error finding order: %w", err)
	}
	if order == nil {
		return nil, errors.New("الطلب غير موجود")
	}

	if !IsOrderCancellable(order.Status) {
		return nil, fmt.Errorf("لا يمكن إلغاء الطلب وهو في حالة: %s", order.Status)
	}

	if reason == "" {
		return nil, errors.New("سبب الإلغاء مطلوب وموثق إجبارياً")
	}

	if actor == "" {
		actor = "الكابتن أحمد (مشرف الصالة)"
	}

	eventID := fmt.Sprintf("ev_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:4])
	cancelNote := fmt.Sprintf("سبب الإلغاء: %s", reason)

	if err := s.orderRepo.UpdateOrderStatus(orderID, models.StatusCancelled, models.PaymentCancelled, actor, cancelNote, eventID); err != nil {
		return nil, fmt.Errorf("failed to cancel order: %w", err)
	}

	updatedOrder, err := s.orderRepo.GetOrderByID(orderID)
	if err != nil || updatedOrder == nil {
		return nil, fmt.Errorf("failed to fetch cancelled order: %w", err)
	}

	// Broadcast cancellation event
	s.hub.Broadcast(realtime.OrderSubscriptionEvent{
		Type:         realtime.EventCancelled,
		Order:        *updatedOrder,
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
		RestaurantID: updatedOrder.RestaurantID,
	})

	if updatedOrder.TableID != "" {
		s.hub.BroadcastTableEvent(realtime.TableEvent{
			EventID:      uuid.New().String(),
			Type:         "order.cancelled",
			RestaurantID: updatedOrder.RestaurantID,
			BranchID:     updatedOrder.BranchID,
			TableID:      updatedOrder.TableID,
			OrderID:      updatedOrder.ID,
			Timestamp:    time.Now().UTC().Format(time.RFC3339),
			Data: ginMap{
				"orderNumber": updatedOrder.OrderNumber,
				"reason":      reason,
			},
		})
	}

	return updatedOrder, nil
}

func (s *OrderService) SimulateIncomingOrder(restaurantID string) (*models.Order, error) {
	if restaurantID == "" {
		restaurantID = "rest-01"
	}

	// Pick a sample table and sample items
	tables := []string{"table-04", "table-02", "table-07", "table-12"}
	chosenTableID := tables[rand.Intn(len(tables))]

	req := models.CreateOrderRequest{
		RestaurantID:  restaurantID,
		TableID:       chosenTableID,
		ForceNewOrder: true,
		Items: []models.CreateOrderItemRequest{
			{
				ProductID: "prod-01",
				Quantity:  1,
				SelectedOptions: []models.CreateOrderItemOptionRequest{
					{GroupID: "opt-size-grill", OptionID: "size-half"},
					{GroupID: "opt-addons-grill", OptionID: "extra-tahina"},
				},
				Notes: "طلب تجريبي فوري عبر زر المحاكاة",
			},
			{
				ProductID: "prod-10",
				Quantity:  2,
			},
		},
	}

	if tbl, err := s.restaurantRepo.GetTableByID(chosenTableID); err == nil && tbl != nil {
		req.TableToken = tbl.Token
	}

	return s.CreateOrder(req)
}
