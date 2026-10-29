package rpc

import (
	"context"
	"time"

	"connectrpc.com/connect"

	restaurantv1 "smart-restaurant-api/gen/restaurant/v1"
	"smart-restaurant-api/gen/restaurant/v1/restaurantv1connect"
	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/services"
)

type InventoryServer struct {
	inventoryService *services.InventoryService
	authService      *services.AuthService
}

func NewInventoryServer(
	inventoryService *services.InventoryService,
	authService *services.AuthService,
) restaurantv1connect.InventoryServiceHandler {
	return &InventoryServer{
		inventoryService: inventoryService,
		authService:      authService,
	}
}

func toProtoInventoryItem(it *models.InventoryItem) *restaurantv1.InventoryItem {
	if it == nil {
		return nil
	}
	itemType := restaurantv1.InventoryItemType_INVENTORY_ITEM_TYPE_RAW_INGREDIENT
	if it.ItemType == models.ItemTypeFinishedGood {
		itemType = restaurantv1.InventoryItemType_INVENTORY_ITEM_TYPE_FINISHED_GOOD
	}
	return &restaurantv1.InventoryItem{
		Id:                   it.ID,
		RestaurantId:         it.RestaurantID,
		Sku:                  it.SKU,
		Name:                 it.Name,
		NameEn:               it.NameEn,
		Description:          it.Description,
		ItemType:             itemType,
		BaseUnit:             it.BaseUnit,
		MinimumStockQuantity: it.MinimumStockQuantity,
		CostPerBaseUnit:      it.CostPerBaseUnit,
		QuantityOnHand:       it.QuantityOnHand,
		IsActive:             it.IsActive,
		CreatedAt:            it.CreatedAt.Format(time.RFC3339),
		UpdatedAt:            it.UpdatedAt.Format(time.RFC3339),
	}
}

func toProtoReceipt(r *models.PurchaseReceipt) *restaurantv1.PurchaseReceipt {
	if r == nil {
		return nil
	}
	status := restaurantv1.ReceiptStatus_RECEIPT_STATUS_DRAFT
	if r.Status == models.ReceiptStatusConfirmed {
		status = restaurantv1.ReceiptStatus_RECEIPT_STATUS_CONFIRMED
	}
	var items []*restaurantv1.PurchaseReceiptItem
	for _, it := range r.Items {
		items = append(items, &restaurantv1.PurchaseReceiptItem{
			Id:                it.ID,
			PurchaseReceiptId: it.PurchaseReceiptID,
			InventoryItemId:   it.InventoryItemID,
			ItemName:          it.ItemName,
			BaseUnit:          it.BaseUnit,
			PurchaseQuantity:  it.PurchaseQuantity,
			PurchaseUnit:      it.PurchaseUnit,
			ConversionFactor:  it.ConversionFactor,
			BaseQuantity:      it.BaseQuantity,
			UnitCost:          it.UnitCost,
			LineTotal:         it.LineTotal,
		})
	}
	return &restaurantv1.PurchaseReceipt{
		Id:               r.ID,
		RestaurantId:     r.RestaurantID,
		ReceiptReference: r.ReceiptReference,
		SupplierName:     r.SupplierName,
		Status:           status,
		TotalCost:        r.TotalCost,
		Notes:            r.Notes,
		CreatedBy:        r.CreatedBy,
		CreatedByName:    r.CreatedByName,
		ConfirmedBy:      r.ConfirmedBy,
		ConfirmedByName:  r.ConfirmedByName,
		CreatedAt:        r.CreatedAt,
		ConfirmedAt:      r.ConfirmedAt,
		Items:            items,
	}
}

func toProtoRecipe(rec *models.MenuItemRecipe) *restaurantv1.MenuItemRecipe {
	if rec == nil {
		return nil
	}
	var ings []*restaurantv1.RecipeIngredient
	for _, ing := range rec.Ingredients {
		ings = append(ings, &restaurantv1.RecipeIngredient{
			Id:                   ing.ID,
			RecipeId:             ing.RecipeID,
			InventoryItemId:      ing.InventoryItemID,
			ItemName:             ing.ItemName,
			QuantityRequired:     ing.QuantityRequired,
			Unit:                 ing.Unit,
			ApplicableOptionId:   ing.ApplicableOptionID,
			ApplicableOptionName: ing.ApplicableOptionName,
		})
	}
	return &restaurantv1.MenuItemRecipe{
		Id:            rec.ID,
		RestaurantId:  rec.RestaurantID,
		MenuProductId: rec.MenuProductID,
		ProductName:   rec.ProductName,
		Version:       int32(rec.Version),
		IsActive:      rec.IsActive,
		Instructions:  rec.Instructions,
		CreatedAt:     rec.CreatedAt,
		UpdatedAt:     rec.UpdatedAt,
		Ingredients:   ings,
	}
}

func toProtoMovement(m *models.InventoryMovement) *restaurantv1.InventoryMovement {
	if m == nil {
		return nil
	}
	var mvType restaurantv1.MovementType
	switch m.MovementType {
	case models.MovementPurchaseReceipt:
		mvType = restaurantv1.MovementType_MOVEMENT_TYPE_PURCHASE_RECEIPT
	case models.MovementOrderConsumption:
		mvType = restaurantv1.MovementType_MOVEMENT_TYPE_ORDER_CONSUMPTION
	case models.MovementManualConsumption:
		mvType = restaurantv1.MovementType_MOVEMENT_TYPE_MANUAL_CONSUMPTION
	case models.MovementWaste:
		mvType = restaurantv1.MovementType_MOVEMENT_TYPE_WASTE
	case models.MovementStockAdjustment:
		mvType = restaurantv1.MovementType_MOVEMENT_TYPE_STOCK_ADJUSTMENT
	case models.MovementReversal:
		mvType = restaurantv1.MovementType_MOVEMENT_TYPE_REVERSAL
	default:
		mvType = restaurantv1.MovementType_MOVEMENT_TYPE_UNSPECIFIED
	}
	return &restaurantv1.InventoryMovement{
		Id:              m.ID,
		RestaurantId:    m.RestaurantID,
		InventoryItemId: m.InventoryItemID,
		ItemName:        m.ItemName,
		MovementType:    mvType,
		QuantityDelta:   m.QuantityDelta,
		BalanceBefore:   m.BalanceBefore,
		BalanceAfter:    m.BalanceAfter,
		UnitCost:        m.UnitCost,
		TotalCost:       m.TotalCost,
		SourceType:      m.SourceType,
		SourceId:        m.SourceID,
		IdempotencyKey:  m.IdempotencyKey,
		Reason:          m.Reason,
		ActorUserId:     m.ActorUserID,
		ActorName:       m.ActorName,
		CreatedAt:       m.CreatedAt,
	}
}

func toProtoAlert(a *models.InventoryAlert) *restaurantv1.InventoryAlert {
	if a == nil {
		return nil
	}
	var alertType restaurantv1.AlertType
	switch a.AlertType {
	case models.AlertLowStock:
		alertType = restaurantv1.AlertType_ALERT_TYPE_LOW_STOCK
	case models.AlertOutOfStock:
		alertType = restaurantv1.AlertType_ALERT_TYPE_OUT_OF_STOCK
	case models.AlertNegativeStock:
		alertType = restaurantv1.AlertType_ALERT_TYPE_NEGATIVE_STOCK
	}
	var alertStatus restaurantv1.AlertStatus
	switch a.Status {
	case models.AlertStatusActive:
		alertStatus = restaurantv1.AlertStatus_ALERT_STATUS_ACTIVE
	case models.AlertStatusAcknowledged:
		alertStatus = restaurantv1.AlertStatus_ALERT_STATUS_ACKNOWLEDGED
	case models.AlertStatusResolved:
		alertStatus = restaurantv1.AlertStatus_ALERT_STATUS_RESOLVED
	}
	return &restaurantv1.InventoryAlert{
		Id:                a.ID,
		RestaurantId:      a.RestaurantID,
		InventoryItemId:   a.InventoryItemID,
		ItemName:          a.ItemName,
		BaseUnit:          a.BaseUnit,
		AlertType:         alertType,
		Status:            alertStatus,
		ThresholdQuantity: a.ThresholdQuantity,
		CurrentQuantity:   a.CurrentQuantity,
		Message:           a.Message,
		CreatedAt:         a.CreatedAt,
		AcknowledgedAt:    a.AcknowledgedAt,
		AcknowledgedBy:    a.AcknowledgedBy,
		ResolvedAt:        a.ResolvedAt,
	}
}

func (s *InventoryServer) ListItems(ctx context.Context, req *connect.Request[restaurantv1.ListItemsRequest]) (*connect.Response[restaurantv1.ListItemsResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	query := models.InventoryItemFilterQuery{
		Search:       req.Msg.GetSearch(),
		ItemType:     req.Msg.GetItemType(),
		IsActive:     req.Msg.IsActive,
		LowStockOnly: req.Msg.LowStockOnly,
	}
	if req.Msg.GetPagination() != nil {
		query.Page = int(req.Msg.GetPagination().GetPage())
		query.PageSize = int(req.Msg.GetPagination().GetPageSize())
	}

	resp, err := s.inventoryService.ListItems(claims.RestaurantID, query)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	items := make([]*restaurantv1.InventoryItem, 0, len(resp.Items))
	for _, it := range resp.Items {
		items = append(items, toProtoInventoryItem(&it))
	}

	return connect.NewResponse(&restaurantv1.ListItemsResponse{
		Items: items,
		Pagination: &restaurantv1.PaginationResponse{
			Page:        int32(resp.Page),
			PageSize:    int32(resp.PageSize),
			TotalItems:  int32(resp.Total),
			TotalPages:  int32(resp.TotalPages),
			HasNextPage: resp.Page < resp.TotalPages,
		},
	}), nil
}

func (s *InventoryServer) CreateItem(ctx context.Context, req *connect.Request[restaurantv1.CreateItemRequest]) (*connect.Response[restaurantv1.CreateItemResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	itemType := models.ItemTypeRawIngredient
	if req.Msg.GetItemType() == restaurantv1.InventoryItemType_INVENTORY_ITEM_TYPE_FINISHED_GOOD {
		itemType = models.ItemTypeFinishedGood
	}

	item, err := s.inventoryService.CreateItem(claims.RestaurantID, claims.UserID, claims.Name, models.CreateInventoryItemRequest{
		SKU:                  req.Msg.GetSku(),
		Name:                 req.Msg.GetName(),
		NameEn:               req.Msg.GetNameEn(),
		Description:          req.Msg.GetDescription(),
		ItemType:             itemType,
		BaseUnit:             req.Msg.GetBaseUnit(),
		MinimumStockQuantity: req.Msg.GetMinimumStockQuantity(),
		CostPerBaseUnit:      req.Msg.GetCostPerBaseUnit(),
		InitialQuantity:      req.Msg.InitialQuantity,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.CreateItemResponse{
		Item: toProtoInventoryItem(item),
	}), nil
}

func (s *InventoryServer) GetItem(ctx context.Context, req *connect.Request[restaurantv1.GetItemRequest]) (*connect.Response[restaurantv1.GetItemResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	item, err := s.inventoryService.GetItem(claims.RestaurantID, req.Msg.GetId())
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	return connect.NewResponse(&restaurantv1.GetItemResponse{
		Item: toProtoInventoryItem(item),
	}), nil
}

func (s *InventoryServer) UpdateItem(ctx context.Context, req *connect.Request[restaurantv1.UpdateItemRequest]) (*connect.Response[restaurantv1.UpdateItemResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	var itemType *models.InventoryItemType
	if req.Msg.ItemType != nil {
		t := models.ItemTypeRawIngredient
		if *req.Msg.ItemType == restaurantv1.InventoryItemType_INVENTORY_ITEM_TYPE_FINISHED_GOOD {
			t = models.ItemTypeFinishedGood
		}
		itemType = &t
	}

	item, err := s.inventoryService.UpdateItem(claims.RestaurantID, req.Msg.GetId(), models.UpdateInventoryItemRequest{
		SKU:                  req.Msg.Sku,
		Name:                 req.Msg.Name,
		NameEn:               req.Msg.NameEn,
		Description:          req.Msg.Description,
		ItemType:             itemType,
		BaseUnit:             req.Msg.BaseUnit,
		MinimumStockQuantity: req.Msg.MinimumStockQuantity,
		CostPerBaseUnit:      req.Msg.CostPerBaseUnit,
		IsActive:             req.Msg.IsActive,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.UpdateItemResponse{
		Item: toProtoInventoryItem(item),
	}), nil
}

func (s *InventoryServer) ListReceipts(ctx context.Context, req *connect.Request[restaurantv1.ListReceiptsRequest]) (*connect.Response[restaurantv1.ListReceiptsResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	query := models.ReceiptFilterQuery{
		Status: req.Msg.GetStatus(),
	}
	if req.Msg.GetPagination() != nil {
		query.Page = int(req.Msg.GetPagination().GetPage())
		query.PageSize = int(req.Msg.GetPagination().GetPageSize())
	}

	resp, err := s.inventoryService.ListReceipts(claims.RestaurantID, query)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	receipts := make([]*restaurantv1.PurchaseReceipt, 0, len(resp.Receipts))
	for _, r := range resp.Receipts {
		receipts = append(receipts, toProtoReceipt(&r))
	}

	return connect.NewResponse(&restaurantv1.ListReceiptsResponse{
		Receipts: receipts,
		Pagination: &restaurantv1.PaginationResponse{
			Page:        int32(resp.Page),
			PageSize:    int32(resp.PageSize),
			TotalItems:  int32(resp.Total),
			TotalPages:  int32(resp.TotalPages),
			HasNextPage: resp.Page < resp.TotalPages,
		},
	}), nil
}

func (s *InventoryServer) CreateReceipt(ctx context.Context, req *connect.Request[restaurantv1.CreateReceiptRequest]) (*connect.Response[restaurantv1.CreateReceiptResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	items := make([]models.CreatePurchaseReceiptItemRequest, 0, len(req.Msg.GetItems()))
	for _, it := range req.Msg.GetItems() {
		items = append(items, models.CreatePurchaseReceiptItemRequest{
			InventoryItemID:  it.GetInventoryItemId(),
			PurchaseQuantity: it.GetPurchaseQuantity(),
			PurchaseUnit:     it.GetPurchaseUnit(),
			ConversionFactor: it.GetConversionFactor(),
			UnitCost:         it.GetUnitCost(),
		})
	}

	receipt, err := s.inventoryService.CreateReceipt(claims.RestaurantID, claims.UserID, models.CreatePurchaseReceiptRequest{
		ReceiptReference: req.Msg.GetReceiptReference(),
		SupplierName:     req.Msg.GetSupplierName(),
		Notes:            req.Msg.GetNotes(),
		Items:            items,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.CreateReceiptResponse{
		Receipt: toProtoReceipt(receipt),
	}), nil
}

func (s *InventoryServer) GetReceipt(ctx context.Context, req *connect.Request[restaurantv1.GetReceiptRequest]) (*connect.Response[restaurantv1.GetReceiptResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	receipt, err := s.inventoryService.GetReceipt(claims.RestaurantID, req.Msg.GetId())
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	return connect.NewResponse(&restaurantv1.GetReceiptResponse{
		Receipt: toProtoReceipt(receipt),
	}), nil
}

func (s *InventoryServer) ConfirmReceipt(ctx context.Context, req *connect.Request[restaurantv1.ConfirmReceiptRequest]) (*connect.Response[restaurantv1.ConfirmReceiptResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	receipt, err := s.inventoryService.ConfirmReceipt(claims.RestaurantID, req.Msg.GetId(), claims.UserID, claims.Name)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.ConfirmReceiptResponse{
		Receipt: toProtoReceipt(receipt),
	}), nil
}

func (s *InventoryServer) ApplyAdjustment(ctx context.Context, req *connect.Request[restaurantv1.ApplyAdjustmentRequest]) (*connect.Response[restaurantv1.ApplyAdjustmentResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	mv, err := s.inventoryService.ApplyAdjustment(claims.RestaurantID, claims.UserID, claims.Name, models.InventoryAdjustmentRequest{
		InventoryItemID: req.Msg.GetInventoryItemId(),
		AdjustmentType:  req.Msg.GetAdjustmentType(),
		QuantityDelta:   req.Msg.GetQuantityDelta(),
		CountedQuantity: req.Msg.GetCountedQuantity(),
		Reason:          req.Msg.GetReason(),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.ApplyAdjustmentResponse{
		Movement: toProtoMovement(mv),
	}), nil
}

func (s *InventoryServer) ListRecipes(ctx context.Context, req *connect.Request[restaurantv1.ListRecipesRequest]) (*connect.Response[restaurantv1.ListRecipesResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	recipes, err := s.inventoryService.ListRecipes(claims.RestaurantID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	protoRecipes := make([]*restaurantv1.MenuItemRecipe, 0, len(recipes))
	for _, r := range recipes {
		protoRecipes = append(protoRecipes, toProtoRecipe(&r))
	}

	return connect.NewResponse(&restaurantv1.ListRecipesResponse{
		Recipes: protoRecipes,
	}), nil
}

func (s *InventoryServer) GetRecipe(ctx context.Context, req *connect.Request[restaurantv1.GetRecipeRequest]) (*connect.Response[restaurantv1.GetRecipeResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	rec, err := s.inventoryService.GetRecipe(claims.RestaurantID, req.Msg.GetMenuItemId())
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	return connect.NewResponse(&restaurantv1.GetRecipeResponse{
		Recipe: toProtoRecipe(rec),
	}), nil
}

func (s *InventoryServer) SaveRecipe(ctx context.Context, req *connect.Request[restaurantv1.SaveRecipeRequest]) (*connect.Response[restaurantv1.SaveRecipeResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	ings := make([]models.CreateRecipeIngredientRequest, 0, len(req.Msg.GetIngredients()))
	for _, i := range req.Msg.GetIngredients() {
		ings = append(ings, models.CreateRecipeIngredientRequest{
			InventoryItemID:    i.GetInventoryItemId(),
			QuantityRequired:   i.GetQuantityRequired(),
			Unit:               i.GetUnit(),
			ApplicableOptionID: i.ApplicableOptionId,
		})
	}

	rec, err := s.inventoryService.SaveRecipe(claims.RestaurantID, req.Msg.GetMenuItemId(), models.SaveRecipeRequest{
		Instructions: req.Msg.GetInstructions(),
		Ingredients:  ings,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.SaveRecipeResponse{
		Recipe: toProtoRecipe(rec),
	}), nil
}

func (s *InventoryServer) ListMovements(ctx context.Context, req *connect.Request[restaurantv1.ListMovementsRequest]) (*connect.Response[restaurantv1.ListMovementsResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	query := models.InventoryMovementFilterQuery{
		InventoryItemID: req.Msg.GetInventoryItemId(),
		MovementType:    req.Msg.GetMovementType(),
		From:            req.Msg.GetFrom(),
		To:              req.Msg.GetTo(),
	}
	if req.Msg.GetPagination() != nil {
		query.Page = int(req.Msg.GetPagination().GetPage())
		query.PageSize = int(req.Msg.GetPagination().GetPageSize())
	}

	resp, err := s.inventoryService.ListMovements(claims.RestaurantID, query)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	mvs := make([]*restaurantv1.InventoryMovement, 0, len(resp.Movements))
	for _, m := range resp.Movements {
		mvs = append(mvs, toProtoMovement(&m))
	}

	return connect.NewResponse(&restaurantv1.ListMovementsResponse{
		Movements: mvs,
		Pagination: &restaurantv1.PaginationResponse{
			Page:        int32(resp.Page),
			PageSize:    int32(resp.PageSize),
			TotalItems:  int32(resp.Total),
			TotalPages:  int32(resp.TotalPages),
			HasNextPage: resp.Page < resp.TotalPages,
		},
	}), nil
}

func (s *InventoryServer) GetSummary(ctx context.Context, req *connect.Request[restaurantv1.GetSummaryRequest]) (*connect.Response[restaurantv1.GetSummaryResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	summary, err := s.inventoryService.GetSummary(claims.RestaurantID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.GetSummaryResponse{
		TotalItems:         int32(summary.TotalItems),
		LowStockItems:      int32(summary.LowStockItems),
		OutOfStockItems:    int32(summary.OutOfStockItems),
		NegativeStockItems: int32(summary.NegativeStockItems),
		TotalValuation:     summary.TotalValuation,
	}), nil
}

func (s *InventoryServer) ListAlerts(ctx context.Context, req *connect.Request[restaurantv1.ListAlertsRequest]) (*connect.Response[restaurantv1.ListAlertsResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	query := models.InventoryAlertFilterQuery{
		Status:    req.Msg.GetStatus(),
		AlertType: req.Msg.GetAlertType(),
	}
	if req.Msg.GetPagination() != nil {
		query.Page = int(req.Msg.GetPagination().GetPage())
		query.PageSize = int(req.Msg.GetPagination().GetPageSize())
	}

	resp, err := s.inventoryService.ListAlerts(claims.RestaurantID, query)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	alerts := make([]*restaurantv1.InventoryAlert, 0, len(resp.Alerts))
	for _, a := range resp.Alerts {
		alerts = append(alerts, toProtoAlert(&a))
	}

	return connect.NewResponse(&restaurantv1.ListAlertsResponse{
		Alerts: alerts,
		Pagination: &restaurantv1.PaginationResponse{
			Page:        int32(resp.Page),
			PageSize:    int32(resp.PageSize),
			TotalItems:  int32(resp.Total),
			TotalPages:  int32(resp.TotalPages),
			HasNextPage: resp.Page < resp.TotalPages,
		},
	}), nil
}

func (s *InventoryServer) ResolveAlert(ctx context.Context, req *connect.Request[restaurantv1.ResolveAlertRequest]) (*connect.Response[restaurantv1.ResolveAlertResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	err = s.inventoryService.ResolveAlert(claims.RestaurantID, req.Msg.GetId(), claims.UserID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.ResolveAlertResponse{
		Alert: &restaurantv1.InventoryAlert{
			Id:     req.Msg.GetId(),
			Status: restaurantv1.AlertStatus_ALERT_STATUS_RESOLVED,
		},
	}), nil
}
