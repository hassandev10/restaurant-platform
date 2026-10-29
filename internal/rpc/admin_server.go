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

type AdminServer struct {
	adminService *services.AdminService
	authService  *services.AuthService
}

func NewAdminServer(
	adminService *services.AdminService,
	authService *services.AuthService,
) restaurantv1connect.AdminServiceHandler {
	return &AdminServer{
		adminService: adminService,
		authService:  authService,
	}
}

func toProtoPromotion(p *models.Promotion) *restaurantv1.Promotion {
	if p == nil {
		return nil
	}
	var maxDiscount *float64
	if p.MaxDiscountAmount != nil {
		maxDiscount = p.MaxDiscountAmount
	}
	var usageLimit *int32
	if p.UsageLimit != nil {
		val := int32(*p.UsageLimit)
		usageLimit = &val
	}
	return &restaurantv1.Promotion{
		Id:                p.ID,
		RestaurantId:      p.RestaurantID,
		Code:              p.Code,
		Title:             p.Title,
		DiscountType:      p.DiscountType,
		DiscountValue:     p.DiscountValue,
		MinOrderAmount:    p.MinOrderAmount,
		MaxDiscountAmount: maxDiscount,
		StartDate:         p.StartDate,
		EndDate:           p.EndDate,
		IsActive:          p.IsActive,
		UsageLimit:        usageLimit,
		TimesUsed:         int32(p.TimesUsed),
		CreatedAt:         p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         p.UpdatedAt.Format(time.RFC3339),
	}
}

func (s *AdminServer) GetDashboardStats(ctx context.Context, req *connect.Request[restaurantv1.GetDashboardStatsRequest]) (*connect.Response[restaurantv1.GetDashboardStatsResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	stats, err := s.adminService.GetDashboardStats(claims)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	statusCounts := make([]*restaurantv1.StatusCount, 0, len(stats.OrdersByStatus))
	for _, sc := range stats.OrdersByStatus {
		statusCounts = append(statusCounts, &restaurantv1.StatusCount{
			Status: parseOrderStatus(string(sc.Status)),
			Count:  int32(sc.Count),
		})
	}

	recentOrders := make([]*restaurantv1.Order, 0, len(stats.RecentOrders))
	for _, o := range stats.RecentOrders {
		recentOrders = append(recentOrders, toProtoOrder(&o))
	}

	bestSellers := make([]*restaurantv1.BestSellerItem, 0, len(stats.BestSellers))
	for _, bs := range stats.BestSellers {
		bestSellers = append(bestSellers, &restaurantv1.BestSellerItem{
			ProductId:    bs.ProductID,
			NameAr:       bs.ProductName,
			OrderCount:   int32(bs.TotalQuantity),
			TotalRevenue: bs.TotalRevenue,
		})
	}

	return connect.NewResponse(&restaurantv1.GetDashboardStatsResponse{
		TodayOrderCount:   int32(stats.TodayOrderCount),
		TodaySales:        stats.TodaySales,
		TotalSales:        stats.TotalSales,
		AverageOrderValue: stats.AverageOrderValue,
		OrdersByStatus:    statusCounts,
		RecentOrders:      recentOrders,
		BestSellers:       bestSellers,
		TableOccupancy: &restaurantv1.TableOccupancyStats{
			TotalTables:        int32(stats.TableOccupancy.TotalTables),
			AvailableTables:    int32(stats.TableOccupancy.AvailableTables),
			OccupiedTables:     int32(stats.TableOccupancy.OccupiedTables),
			ReservedTables:     int32(stats.TableOccupancy.ReservedTables),
			CleaningTables:     int32(stats.TableOccupancy.CleaningTables),
			OutOfServiceTables: int32(stats.TableOccupancy.OutOfServiceTables),
			OccupancyRate:      stats.TableOccupancy.OccupancyRate,
		},
		GeneratedAt: stats.GeneratedAt,
	}), nil
}

func (s *AdminServer) GetAnalytics(ctx context.Context, req *connect.Request[restaurantv1.GetAnalyticsRequest]) (*connect.Response[restaurantv1.GetAnalyticsResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	analytics, err := s.adminService.GetAnalytics(claims, req.Msg.GetFrom(), req.Msg.GetTo())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	salesTrend := make([]*restaurantv1.DailySalesPoint, 0, len(analytics.SalesTrend))
	for _, p := range analytics.SalesTrend {
		salesTrend = append(salesTrend, &restaurantv1.DailySalesPoint{
			Date:    p.Date,
			Revenue: p.Revenue,
			Orders:  int32(p.Orders),
		})
	}

	statusDist := make([]*restaurantv1.StatusCount, 0, len(analytics.StatusDistribution))
	for _, sc := range analytics.StatusDistribution {
		statusDist = append(statusDist, &restaurantv1.StatusCount{
			Status: parseOrderStatus(string(sc.Status)),
			Count:  int32(sc.Count),
		})
	}

	hourlyDist := make([]*restaurantv1.HourlyDistributionPoint, 0, len(analytics.HourlyDistribution))
	for _, hd := range analytics.HourlyDistribution {
		hourlyDist = append(hourlyDist, &restaurantv1.HourlyDistributionPoint{
			Hour:   int32(hd.Hour),
			Orders: int32(hd.Orders),
		})
	}

	topCats := make([]*restaurantv1.CategoryRevenuePoint, 0, len(analytics.TopCategories))
	for _, tc := range analytics.TopCategories {
		topCats = append(topCats, &restaurantv1.CategoryRevenuePoint{
			CategoryId:   tc.CategoryID,
			CategoryName: tc.CategoryName,
			Revenue:      tc.Revenue,
			ItemsSold:    int32(tc.ItemsSold),
		})
	}

	return connect.NewResponse(&restaurantv1.GetAnalyticsResponse{
		From:               analytics.From,
		To:                 analytics.To,
		TotalRevenue:       analytics.TotalRevenue,
		TotalOrders:        int32(analytics.TotalOrders),
		AverageOrderValue:  analytics.AverageOrderValue,
		ServedOrders:       int32(analytics.ServedOrders),
		CancelledOrders:    int32(analytics.CancelledOrders),
		SalesTrend:         salesTrend,
		StatusDistribution: statusDist,
		HourlyDistribution: hourlyDist,
		TopCategories:      topCats,
	}), nil
}

func (s *AdminServer) ListPromotions(ctx context.Context, req *connect.Request[restaurantv1.ListPromotionsRequest]) (*connect.Response[restaurantv1.ListPromotionsResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	promos, err := s.adminService.ListPromotions(claims)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	protoPromos := make([]*restaurantv1.Promotion, 0, len(promos))
	for _, p := range promos {
		protoPromos = append(protoPromos, toProtoPromotion(&p))
	}

	return connect.NewResponse(&restaurantv1.ListPromotionsResponse{
		Promotions: protoPromos,
	}), nil
}

func (s *AdminServer) CreatePromotion(ctx context.Context, req *connect.Request[restaurantv1.CreatePromotionRequest]) (*connect.Response[restaurantv1.CreatePromotionResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	var usageLimit *int
	if req.Msg.UsageLimit != nil {
		val := int(*req.Msg.UsageLimit)
		usageLimit = &val
	}

	promo, err := s.adminService.CreatePromotion(claims, models.CreatePromotionRequest{
		Code:              req.Msg.GetCode(),
		Title:             req.Msg.GetTitle(),
		DiscountType:      req.Msg.GetDiscountType(),
		DiscountValue:     req.Msg.GetDiscountValue(),
		MinOrderAmount:    req.Msg.GetMinOrderAmount(),
		MaxDiscountAmount: req.Msg.MaxDiscountAmount,
		StartDate:         req.Msg.StartDate,
		EndDate:           req.Msg.EndDate,
		IsActive:          req.Msg.IsActive,
		UsageLimit:        usageLimit,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.CreatePromotionResponse{
		Promotion: toProtoPromotion(promo),
	}), nil
}

func (s *AdminServer) GetPromotion(ctx context.Context, req *connect.Request[restaurantv1.GetPromotionRequest]) (*connect.Response[restaurantv1.GetPromotionResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	promo, err := s.adminService.GetPromotion(claims, req.Msg.GetId())
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	return connect.NewResponse(&restaurantv1.GetPromotionResponse{
		Promotion: toProtoPromotion(promo),
	}), nil
}

func (s *AdminServer) UpdatePromotion(ctx context.Context, req *connect.Request[restaurantv1.UpdatePromotionRequest]) (*connect.Response[restaurantv1.UpdatePromotionResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	var usageLimit *int
	if req.Msg.UsageLimit != nil {
		val := int(*req.Msg.UsageLimit)
		usageLimit = &val
	}

	promo, err := s.adminService.UpdatePromotion(claims, req.Msg.GetId(), models.UpdatePromotionRequest{
		Title:             req.Msg.Title,
		DiscountType:      req.Msg.DiscountType,
		DiscountValue:     req.Msg.DiscountValue,
		MinOrderAmount:    req.Msg.MinOrderAmount,
		MaxDiscountAmount: req.Msg.MaxDiscountAmount,
		StartDate:         req.Msg.StartDate,
		EndDate:           req.Msg.EndDate,
		IsActive:          req.Msg.IsActive,
		UsageLimit:        usageLimit,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.UpdatePromotionResponse{
		Promotion: toProtoPromotion(promo),
	}), nil
}

func (s *AdminServer) DeletePromotion(ctx context.Context, req *connect.Request[restaurantv1.DeletePromotionRequest]) (*connect.Response[restaurantv1.DeletePromotionResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	err = s.adminService.DeletePromotion(claims, req.Msg.GetId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.DeletePromotionResponse{
		Success: true,
	}), nil
}

func (s *AdminServer) ListOrders(ctx context.Context, req *connect.Request[restaurantv1.ListOrdersRequest]) (*connect.Response[restaurantv1.ListOrdersResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	query := models.AdminOrderFilterQuery{
		Status: req.Msg.GetStatus(),
	}
	if req.Msg.GetPagination() != nil {
		query.Page = int(req.Msg.GetPagination().GetPage())
		query.PageSize = int(req.Msg.GetPagination().GetPageSize())
	}

	resp, err := s.adminService.ListOrders(claims, query)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	orders := make([]*restaurantv1.Order, 0, len(resp.Orders))
	for _, o := range resp.Orders {
		orders = append(orders, toProtoOrder(&o))
	}

	return connect.NewResponse(&restaurantv1.ListOrdersResponse{
		Orders: orders,
		Pagination: &restaurantv1.PaginationResponse{
			Page:        int32(resp.Page),
			PageSize:    int32(resp.PageSize),
			TotalItems:  int32(resp.Total),
			TotalPages:  int32(resp.Pagination.TotalPages),
			HasNextPage: resp.Pagination.HasNextPage,
		},
	}), nil
}
