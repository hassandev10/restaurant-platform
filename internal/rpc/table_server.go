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

type TableServer struct {
	tableService *services.TableService
	authService  *services.AuthService
}

func NewTableServer(
	tableService *services.TableService,
	authService *services.AuthService,
) restaurantv1connect.TableServiceHandler {
	return &TableServer{
		tableService: tableService,
		authService:  authService,
	}
}

func toProtoTableStatus(s models.TableStatus) restaurantv1.TableStatus {
	switch s {
	case models.TableStatusAvailable:
		return restaurantv1.TableStatus_TABLE_STATUS_AVAILABLE
	case models.TableStatusOccupied:
		return restaurantv1.TableStatus_TABLE_STATUS_OCCUPIED
	case models.TableStatusReserved:
		return restaurantv1.TableStatus_TABLE_STATUS_RESERVED
	case models.TableStatusCleaning:
		return restaurantv1.TableStatus_TABLE_STATUS_CLEANING
	case models.TableStatusOutOfService:
		return restaurantv1.TableStatus_TABLE_STATUS_OUT_OF_SERVICE
	default:
		return restaurantv1.TableStatus_TABLE_STATUS_UNSPECIFIED
	}
}

func fromProtoTableStatus(s restaurantv1.TableStatus) models.TableStatus {
	switch s {
	case restaurantv1.TableStatus_TABLE_STATUS_AVAILABLE:
		return models.TableStatusAvailable
	case restaurantv1.TableStatus_TABLE_STATUS_OCCUPIED:
		return models.TableStatusOccupied
	case restaurantv1.TableStatus_TABLE_STATUS_RESERVED:
		return models.TableStatusReserved
	case restaurantv1.TableStatus_TABLE_STATUS_CLEANING:
		return models.TableStatusCleaning
	case restaurantv1.TableStatus_TABLE_STATUS_OUT_OF_SERVICE:
		return models.TableStatusOutOfService
	default:
		return ""
	}
}

func toProtoDiningTable(t *models.RestaurantTable) *restaurantv1.DiningTable {
	if t == nil {
		return nil
	}
	var sectionID string
	if t.SectionID != nil {
		sectionID = *t.SectionID
	}
	var currentSession *restaurantv1.TableSession
	if t.CurrentSession != nil {
		currentSession = &restaurantv1.TableSession{
			Id:              t.CurrentSession.ID,
			TableId:         t.ID,
			OpenedAt:        t.CurrentSession.OpenedAt,
			Status:          restaurantv1.SessionStatus_SESSION_STATUS_OPEN,
			DurationMinutes: int32(t.CurrentSession.DurationMinutes),
			OrdersCount:     int32(t.CurrentSession.OrdersCount),
			Total:           t.CurrentSession.Total,
		}
	}
	return &restaurantv1.DiningTable{
		Id:             t.ID,
		RestaurantId:   t.RestaurantID,
		BranchId:       t.BranchID,
		TableNumber:    t.TableNumber,
		DisplayName:    t.DisplayName,
		Capacity:       int32(t.Capacity),
		SectionId:      sectionID,
		SectionName:    t.SectionName,
		Token:          t.Token,
		Status:         toProtoTableStatus(t.Status),
		IsActive:       t.IsActive,
		CurrentSession: currentSession,
		CreatedAt:      t.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      t.UpdatedAt.Format(time.RFC3339),
	}
}

func toProtoSession(s *models.TableSession) *restaurantv1.TableSession {
	if s == nil {
		return nil
	}
	var closedAt string
	if s.ClosedAt != nil {
		closedAt = s.ClosedAt.Format(time.RFC3339)
	}
	st := restaurantv1.SessionStatus_SESSION_STATUS_OPEN
	if s.Status == models.SessionStatusClosed {
		st = restaurantv1.SessionStatus_SESSION_STATUS_CLOSED
	}
	return &restaurantv1.TableSession{
		Id:              s.ID,
		TableId:         s.TableID,
		OpenedAt:        s.OpenedAt.Format(time.RFC3339),
		ClosedAt:        closedAt,
		OpenedBy:        s.OpenedByName,
		ClosedBy:        s.ClosedByName,
		Status:          st,
		DurationMinutes: int32(s.DurationMinutes),
		Notes:           s.Notes,
		OrdersCount:     int32(s.OrdersCount),
		Total:           s.Total,
	}
}

func (s *TableServer) ListTables(ctx context.Context, req *connect.Request[restaurantv1.ListTablesRequest]) (*connect.Response[restaurantv1.ListTablesResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	filter := models.TableFilterQuery{}
	if req.Msg.GetFilter() != nil {
		f := req.Msg.GetFilter()
		if f.Status != nil {
			filter.Status = string(fromProtoTableStatus(*f.Status))
		}
		if f.SectionId != nil {
			filter.SectionID = *f.SectionId
		}
		if f.Search != nil {
			filter.Search = *f.Search
		}
		if f.Page != nil {
			filter.Page = int(*f.Page)
		}
		if f.PageSize != nil {
			filter.PageSize = int(*f.PageSize)
		}
	}

	resp, err := s.tableService.ListTables(claims, filter)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	tables := make([]*restaurantv1.DiningTable, 0, len(resp.Tables))
	for _, t := range resp.Tables {
		tables = append(tables, toProtoDiningTable(&t))
	}

	return connect.NewResponse(&restaurantv1.ListTablesResponse{
		Tables:     tables,
		Total:      int32(resp.Total),
		Page:       int32(resp.Page),
		PageSize:   int32(resp.PageSize),
		TotalPages: int32(resp.TotalPages),
	}), nil
}

func (s *TableServer) GetTable(ctx context.Context, req *connect.Request[restaurantv1.GetTableRequest]) (*connect.Response[restaurantv1.GetTableResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	table, err := s.tableService.GetTableDetails(claims, req.Msg.GetTableId())
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	return connect.NewResponse(&restaurantv1.GetTableResponse{
		Table: toProtoDiningTable(table),
	}), nil
}

func (s *TableServer) CreateTable(ctx context.Context, req *connect.Request[restaurantv1.CreateTableRequest]) (*connect.Response[restaurantv1.CreateTableResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	table, err := s.tableService.CreateTable(claims, models.CreateTableRequest{
		TableNumber: req.Msg.GetTableNumber(),
		DisplayName: req.Msg.GetDisplayName(),
		Capacity:    int(req.Msg.GetCapacity()),
		SectionID:   req.Msg.GetSectionId(),
		BranchID:    req.Msg.GetBranchId(),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.CreateTableResponse{
		Table: toProtoDiningTable(table),
	}), nil
}

func (s *TableServer) UpdateTable(ctx context.Context, req *connect.Request[restaurantv1.UpdateTableRequest]) (*connect.Response[restaurantv1.UpdateTableResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	updateReq := models.UpdateTableRequest{
		DisplayName: req.Msg.DisplayName,
		SectionID:   req.Msg.SectionId,
	}
	if req.Msg.Capacity != nil {
		capVal := int(*req.Msg.Capacity)
		updateReq.Capacity = &capVal
	}
	if req.Msg.Status != nil {
		st := fromProtoTableStatus(*req.Msg.Status)
		updateReq.Status = &st
	}

	table, err := s.tableService.UpdateTable(claims, req.Msg.GetTableId(), updateReq)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.UpdateTableResponse{
		Table: toProtoDiningTable(table),
	}), nil
}

func (s *TableServer) DeleteTable(ctx context.Context, req *connect.Request[restaurantv1.DeleteTableRequest]) (*connect.Response[restaurantv1.DeleteTableResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	err = s.tableService.DeleteTable(claims, req.Msg.GetTableId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.DeleteTableResponse{
		Success: true,
	}), nil
}

func (s *TableServer) ToggleTableActive(ctx context.Context, req *connect.Request[restaurantv1.ToggleTableActiveRequest]) (*connect.Response[restaurantv1.ToggleTableActiveResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	err = s.tableService.ToggleTableActive(claims, req.Msg.GetTableId(), req.Msg.GetIsActive())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	table, err := s.tableService.GetTableDetails(claims, req.Msg.GetTableId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.ToggleTableActiveResponse{
		Table: toProtoDiningTable(table),
	}), nil
}

func (s *TableServer) GetTableQR(ctx context.Context, req *connect.Request[restaurantv1.GetTableQRRequest]) (*connect.Response[restaurantv1.GetTableQRResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	qr, err := s.tableService.GetTableQRDetails(claims, req.Msg.GetTableId())
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	return connect.NewResponse(&restaurantv1.GetTableQRResponse{
		Qr: &restaurantv1.TableQR{
			TableId:     qr.TableID,
			QrCodeUrl:   qr.CustomerURL,
			Token:       qr.Token,
			TableNumber: qr.TableNumber,
		},
	}), nil
}

func (s *TableServer) RegenerateTableQR(ctx context.Context, req *connect.Request[restaurantv1.RegenerateTableQRRequest]) (*connect.Response[restaurantv1.RegenerateTableQRResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	qr, err := s.tableService.RegenerateTableQR(claims, req.Msg.GetTableId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.RegenerateTableQRResponse{
		Qr: &restaurantv1.TableQR{
			TableId:     qr.TableID,
			QrCodeUrl:   qr.CustomerURL,
			Token:       qr.Token,
			TableNumber: qr.TableNumber,
		},
	}), nil
}

func (s *TableServer) ValidateTableNumber(ctx context.Context, req *connect.Request[restaurantv1.ValidateTableNumberRequest]) (*connect.Response[restaurantv1.ValidateTableNumberResponse], error) {
	resp, err := s.tableService.ValidateTableForCustomer(req.Msg.GetRestaurantSlug(), req.Msg.GetTableInput())
	if err != nil {
		return connect.NewResponse(&restaurantv1.ValidateTableNumberResponse{
			Valid:        false,
			ErrorMessage: err.Error(),
			Code:         "VALIDATION_FAILED",
		}), nil
	}

	return connect.NewResponse(&restaurantv1.ValidateTableNumberResponse{
		Valid: true,
		Table: &restaurantv1.DiningTable{
			TableNumber: resp.Table.TableNumber,
			DisplayName: resp.Table.DisplayName,
			Capacity:    int32(resp.Table.Capacity),
			SectionName: resp.Table.SectionName,
			Status:      toProtoTableStatus(resp.Table.Status),
		},
		Token:             resp.TableToken,
		TableContextToken: resp.TableContextToken,
	}), nil
}

func (s *TableServer) ListSections(ctx context.Context, req *connect.Request[restaurantv1.ListSectionsRequest]) (*connect.Response[restaurantv1.ListSectionsResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	sections, err := s.tableService.ListSections(claims)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	protoSecs := make([]*restaurantv1.TableSection, 0, len(sections))
	for _, sec := range sections {
		protoSecs = append(protoSecs, &restaurantv1.TableSection{
			Id:           sec.ID,
			RestaurantId: sec.RestaurantID,
			BranchId:     sec.BranchID,
			Name:         sec.Name,
			DisplayOrder: int32(sec.DisplayOrder),
			CreatedAt:    sec.CreatedAt.Format(time.RFC3339),
		})
	}

	return connect.NewResponse(&restaurantv1.ListSectionsResponse{
		Sections: protoSecs,
	}), nil
}

func (s *TableServer) CreateSection(ctx context.Context, req *connect.Request[restaurantv1.CreateSectionRequest]) (*connect.Response[restaurantv1.CreateSectionResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	var branchID string
	if req.Msg.BranchId != nil {
		branchID = *req.Msg.BranchId
	}

	sec, err := s.tableService.CreateSection(claims, models.CreateSectionRequest{
		Name:         req.Msg.GetName(),
		DisplayOrder: int(req.Msg.GetDisplayOrder()),
		BranchID:     branchID,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.CreateSectionResponse{
		Section: &restaurantv1.TableSection{
			Id:           sec.ID,
			RestaurantId: sec.RestaurantID,
			BranchId:     sec.BranchID,
			Name:         sec.Name,
			DisplayOrder: int32(sec.DisplayOrder),
			CreatedAt:    sec.CreatedAt.Format(time.RFC3339),
		},
	}), nil
}

func (s *TableServer) OpenSession(ctx context.Context, req *connect.Request[restaurantv1.OpenSessionRequest]) (*connect.Response[restaurantv1.OpenSessionResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	sess, err := s.tableService.OpenSession(claims, req.Msg.GetTableId(), models.OpenSessionRequest{
		Notes: req.Msg.GetNotes(),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.OpenSessionResponse{
		Session: toProtoSession(sess),
	}), nil
}

func (s *TableServer) CloseSession(ctx context.Context, req *connect.Request[restaurantv1.CloseSessionRequest]) (*connect.Response[restaurantv1.CloseSessionResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	sess, err := s.tableService.CloseSession(claims, req.Msg.GetTableId(), req.Msg.GetSessionId(), models.CloseSessionRequest{
		Notes: req.Msg.GetNotes(),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.CloseSessionResponse{
		Session: toProtoSession(sess),
	}), nil
}

func (s *TableServer) GetTableSession(ctx context.Context, req *connect.Request[restaurantv1.GetTableSessionRequest]) (*connect.Response[restaurantv1.GetTableSessionResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	sess, err := s.tableService.GetTableSession(claims, req.Msg.GetTableId())
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	return connect.NewResponse(&restaurantv1.GetTableSessionResponse{
		Session: toProtoSession(sess),
	}), nil
}
