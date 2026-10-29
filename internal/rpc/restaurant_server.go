package rpc

import (
	"context"
	"errors"
	"time"

	"connectrpc.com/connect"

	restaurantv1 "smart-restaurant-api/gen/restaurant/v1"
	"smart-restaurant-api/gen/restaurant/v1/restaurantv1connect"
	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/repositories"
	"smart-restaurant-api/internal/services"
)

type RestaurantServer struct {
	restaurantRepo *repositories.RestaurantRepository
	adminService   *services.AdminService
	authService    *services.AuthService
}

func NewRestaurantServer(
	restaurantRepo *repositories.RestaurantRepository,
	adminService *services.AdminService,
	authService *services.AuthService,
) restaurantv1connect.RestaurantServiceHandler {
	return &RestaurantServer{
		restaurantRepo: restaurantRepo,
		adminService:   adminService,
		authService:    authService,
	}
}

func toProtoRestaurant(r *models.Restaurant) *restaurantv1.Restaurant {
	if r == nil {
		return nil
	}
	return &restaurantv1.Restaurant{
		Id:                          r.ID,
		Name:                        r.Name,
		Slug:                        r.Slug,
		Description:                 r.Description,
		LogoUrl:                     r.LogoURL,
		Currency:                    r.Currency,
		IsOpen:                      r.IsOpen,
		EstimatedPreparationMinutes: int32(r.EstimatedPreparationMinutes),
		Phone:                       r.Phone,
		Address:                     r.Address,
		OpeningHours:                r.OpeningHours,
		TaxRate:                     r.TaxRate,
		ServiceFeeRate:              r.ServiceFeeRate,
		CreatedAt:                   r.CreatedAt.Format(time.RFC3339),
		UpdatedAt:                   r.UpdatedAt.Format(time.RFC3339),
	}
}

func toProtoBranch(b *models.Branch) *restaurantv1.Branch {
	if b == nil {
		return nil
	}
	return &restaurantv1.Branch{
		Id:           b.ID,
		RestaurantId: b.RestaurantID,
		Name:         b.Name,
		CreatedAt:    b.CreatedAt.Format(time.RFC3339),
	}
}

func (s *RestaurantServer) GetRestaurant(ctx context.Context, req *connect.Request[restaurantv1.GetRestaurantRequest]) (*connect.Response[restaurantv1.GetRestaurantResponse], error) {
	slug := req.Msg.GetSlug()
	if slug == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("slug is required"))
	}

	rest, err := s.restaurantRepo.GetRestaurantBySlug(slug)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	return connect.NewResponse(&restaurantv1.GetRestaurantResponse{
		Restaurant: toProtoRestaurant(rest),
	}), nil
}

func (s *RestaurantServer) UpdateRestaurantSettings(ctx context.Context, req *connect.Request[restaurantv1.UpdateRestaurantSettingsRequest]) (*connect.Response[restaurantv1.UpdateRestaurantSettingsResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	updateReq := models.UpdateRestaurantSettingsRequest{
		Name:                        req.Msg.Name,
		Description:                 req.Msg.Description,
		LogoURL:                     req.Msg.LogoUrl,
		Currency:                    req.Msg.Currency,
		IsOpen:                      req.Msg.IsOpen,
		Phone:                       req.Msg.Phone,
		Address:                     req.Msg.Address,
		OpeningHours:                req.Msg.OpeningHours,
		TaxRate:                     req.Msg.TaxRate,
		ServiceFeeRate:              req.Msg.ServiceFeeRate,
	}
	if req.Msg.EstimatedPreparationMinutes != nil {
		val := int(*req.Msg.EstimatedPreparationMinutes)
		updateReq.EstimatedPreparationMinutes = &val
	}

	rest, err := s.adminService.UpdateRestaurantSettings(claims, updateReq)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.UpdateRestaurantSettingsResponse{
		Restaurant: toProtoRestaurant(rest),
	}), nil
}

func (s *RestaurantServer) GetBranch(ctx context.Context, req *connect.Request[restaurantv1.GetBranchRequest]) (*connect.Response[restaurantv1.GetBranchResponse], error) {
	branchID := req.Msg.GetBranchId()
	if branchID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("branch_id is required"))
	}

	b, err := s.restaurantRepo.GetBranchByID(branchID)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	return connect.NewResponse(&restaurantv1.GetBranchResponse{
		Branch: toProtoBranch(b),
	}), nil
}
