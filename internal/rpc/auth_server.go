package rpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	restaurantv1 "smart-restaurant-api/gen/restaurant/v1"
	"smart-restaurant-api/gen/restaurant/v1/restaurantv1connect"
	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/services"
)

type AuthServer struct {
	authService *services.AuthService
}

func NewAuthServer(authService *services.AuthService) restaurantv1connect.AuthServiceHandler {
	return &AuthServer{
		authService: authService,
	}
}

func (s *AuthServer) Login(ctx context.Context, req *connect.Request[restaurantv1.LoginRequest]) (*connect.Response[restaurantv1.LoginResponse], error) {
	if req.Msg.GetUsername() == "" || req.Msg.GetPassword() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("اسم المستخدم وكلمة المرور مطلوبة"))
	}

	res, err := s.authService.Login(models.LoginRequest{
		Username: req.Msg.GetUsername(),
		Password: req.Msg.GetPassword(),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	return connect.NewResponse(&restaurantv1.LoginResponse{
		Token: res.Token,
		User:  toProtoStaffUser(&res.User),
	}), nil
}

func (s *AuthServer) GetMe(ctx context.Context, req *connect.Request[restaurantv1.GetMeRequest]) (*connect.Response[restaurantv1.GetMeResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&restaurantv1.GetMeResponse{
		User: &restaurantv1.StaffUser{
			Id:           claims.UserID,
			RestaurantId: claims.RestaurantID,
			BranchId:     claims.BranchID,
			Username:     claims.Username,
			Name:         claims.Name,
			Role:         parseStaffRole(claims.Role),
			IsActive:     true,
		},
	}), nil
}

func (s *AuthServer) Logout(ctx context.Context, req *connect.Request[restaurantv1.LogoutRequest]) (*connect.Response[restaurantv1.LogoutResponse], error) {
	return connect.NewResponse(&restaurantv1.LogoutResponse{
		Success: true,
	}), nil
}
