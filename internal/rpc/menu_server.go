package rpc

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	restaurantv1 "smart-restaurant-api/gen/restaurant/v1"
	"smart-restaurant-api/gen/restaurant/v1/restaurantv1connect"
	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/repositories"
	"smart-restaurant-api/internal/services"
)

type MenuServer struct {
	restaurantRepo *repositories.RestaurantRepository
	menuRepo       *repositories.MenuRepository
	adminService   *services.AdminService
	authService    *services.AuthService
}

func NewMenuServer(
	restaurantRepo *repositories.RestaurantRepository,
	menuRepo *repositories.MenuRepository,
	adminService *services.AdminService,
	authService *services.AuthService,
) restaurantv1connect.MenuServiceHandler {
	return &MenuServer{
		restaurantRepo: restaurantRepo,
		menuRepo:       menuRepo,
		adminService:   adminService,
		authService:    authService,
	}
}

func toProtoCategory(c *models.MenuCategory) *restaurantv1.MenuCategory {
	if c == nil {
		return nil
	}
	return &restaurantv1.MenuCategory{
		Id:           c.ID,
		RestaurantId: c.RestaurantID,
		NameAr:       c.NameAr,
		NameEn:       c.NameEn,
		DisplayOrder: int32(c.DisplayOrder),
		IsActive:     c.IsActive,
		IconName:     c.IconName,
	}
}

func toProtoProduct(p *models.Product) *restaurantv1.Product {
	if p == nil {
		return nil
	}
	var optionGroups []*restaurantv1.ProductOptionGroup
	for _, g := range p.Options {
		var opts []*restaurantv1.ProductOption
		for _, o := range g.Options {
			opts = append(opts, &restaurantv1.ProductOption{
				Id:            o.ID,
				NameAr:        o.NameAr,
				PriceModifier: o.PriceDelta,
				IsAvailable:   o.IsAvailable,
			})
		}
		var minSel, maxSel int32
		if g.MinSelections != nil {
			minSel = int32(*g.MinSelections)
		}
		if g.MaxSelections != nil {
			maxSel = int32(*g.MaxSelections)
		}
		optionGroups = append(optionGroups, &restaurantv1.ProductOptionGroup{
			Id:           g.ID,
			NameAr:       g.NameAr,
			IsRequired:   g.IsRequired,
			MinSelection: minSel,
			MaxSelection: maxSel,
			Options:      opts,
		})
	}
	return &restaurantv1.Product{
		Id:           p.ID,
		RestaurantId: p.RestaurantID,
		CategoryId:   p.CategoryID,
		NameAr:       p.NameAr,
		NameEn:       p.NameEn,
		Description:  p.Description,
		Price:        p.Price,
		ImageUrl:     p.ImageURL,
		IsAvailable:  p.IsAvailable,
		IsFeatured:   p.IsFeatured,
		Badge:        p.Badge,
		Options:      optionGroups,
	}
}

func (s *MenuServer) GetMenu(ctx context.Context, req *connect.Request[restaurantv1.GetMenuRequest]) (*connect.Response[restaurantv1.GetMenuResponse], error) {
	slug := req.Msg.GetRestaurantSlug()
	if slug == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("restaurant_slug is required"))
	}

	rest, err := s.restaurantRepo.GetRestaurantBySlug(slug)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	categories, err := s.menuRepo.GetCategories(rest.ID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	products, err := s.menuRepo.GetProducts(rest.ID, "", "")
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	protoCats := make([]*restaurantv1.MenuCategory, 0, len(categories))
	for _, c := range categories {
		protoCats = append(protoCats, toProtoCategory(&c))
	}

	protoProds := make([]*restaurantv1.Product, 0, len(products))
	for _, p := range products {
		protoProds = append(protoProds, toProtoProduct(&p))
	}

	return connect.NewResponse(&restaurantv1.GetMenuResponse{
		Restaurant: toProtoRestaurant(rest),
		Categories: protoCats,
		Products:   protoProds,
	}), nil
}

func (s *MenuServer) ListCategories(ctx context.Context, req *connect.Request[restaurantv1.ListCategoriesRequest]) (*connect.Response[restaurantv1.ListCategoriesResponse], error) {
	slug := req.Msg.GetRestaurantSlug()
	var restaurantID string
	if slug != "" {
		rest, err := s.restaurantRepo.GetRestaurantBySlug(slug)
		if err != nil {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		restaurantID = rest.ID
	} else {
		claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
		if err != nil {
			return nil, err
		}
		restaurantID = claims.RestaurantID
	}

	cats, err := s.menuRepo.GetCategories(restaurantID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	protoCats := make([]*restaurantv1.MenuCategory, 0, len(cats))
	for _, c := range cats {
		protoCats = append(protoCats, toProtoCategory(&c))
	}

	return connect.NewResponse(&restaurantv1.ListCategoriesResponse{
		Categories: protoCats,
	}), nil
}

func (s *MenuServer) GetCategory(ctx context.Context, req *connect.Request[restaurantv1.GetCategoryRequest]) (*connect.Response[restaurantv1.GetCategoryResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	cat, err := s.adminService.GetCategory(claims, req.Msg.GetCategoryId())
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	return connect.NewResponse(&restaurantv1.GetCategoryResponse{
		Category: toProtoCategory(cat),
	}), nil
}

func (s *MenuServer) CreateCategory(ctx context.Context, req *connect.Request[restaurantv1.CreateCategoryRequest]) (*connect.Response[restaurantv1.CreateCategoryResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	isActive := req.Msg.GetIsActive()
	cat, err := s.adminService.CreateCategory(claims, models.CreateCategoryRequest{
		NameAr:       req.Msg.GetNameAr(),
		NameEn:       req.Msg.GetNameEn(),
		DisplayOrder: int(req.Msg.GetDisplayOrder()),
		IsActive:     &isActive,
		IconName:     req.Msg.GetIconName(),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.CreateCategoryResponse{
		Category: toProtoCategory(cat),
	}), nil
}

func (s *MenuServer) UpdateCategory(ctx context.Context, req *connect.Request[restaurantv1.UpdateCategoryRequest]) (*connect.Response[restaurantv1.UpdateCategoryResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	updateReq := models.UpdateCategoryRequest{
		NameAr:   req.Msg.NameAr,
		NameEn:   req.Msg.NameEn,
		IsActive: req.Msg.IsActive,
		IconName: req.Msg.IconName,
	}
	if req.Msg.DisplayOrder != nil {
		order := int(*req.Msg.DisplayOrder)
		updateReq.DisplayOrder = &order
	}

	cat, err := s.adminService.UpdateCategory(claims, req.Msg.GetId(), updateReq)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.UpdateCategoryResponse{
		Category: toProtoCategory(cat),
	}), nil
}

func (s *MenuServer) DeleteCategory(ctx context.Context, req *connect.Request[restaurantv1.DeleteCategoryRequest]) (*connect.Response[restaurantv1.DeleteCategoryResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	err = s.adminService.DeleteCategory(claims, req.Msg.GetId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.DeleteCategoryResponse{
		Success: true,
	}), nil
}

func (s *MenuServer) ReorderCategories(ctx context.Context, req *connect.Request[restaurantv1.ReorderCategoriesRequest]) (*connect.Response[restaurantv1.ReorderCategoriesResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	items := make([]models.ReorderCategoryItem, 0, len(req.Msg.GetItems()))
	for _, it := range req.Msg.GetItems() {
		items = append(items, models.ReorderCategoryItem{
			ID:           it.GetId(),
			DisplayOrder: int(it.GetDisplayOrder()),
		})
	}

	err = s.adminService.ReorderCategories(claims, models.ReorderCategoriesRequest{Items: items})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.ReorderCategoriesResponse{
		Success: true,
	}), nil
}

func (s *MenuServer) ListProducts(ctx context.Context, req *connect.Request[restaurantv1.ListProductsRequest]) (*connect.Response[restaurantv1.ListProductsResponse], error) {
	slug := req.Msg.GetRestaurantSlug()
	var restaurantID string
	if slug != "" {
		rest, err := s.restaurantRepo.GetRestaurantBySlug(slug)
		if err != nil {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		restaurantID = rest.ID
	} else {
		claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
		if err != nil {
			return nil, err
		}
		restaurantID = claims.RestaurantID
	}

	products, err := s.menuRepo.GetProducts(restaurantID, req.Msg.GetCategoryId(), req.Msg.GetQuery())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	protoProds := make([]*restaurantv1.Product, 0, len(products))
	for _, p := range products {
		protoProds = append(protoProds, toProtoProduct(&p))
	}

	return connect.NewResponse(&restaurantv1.ListProductsResponse{
		Products: protoProds,
	}), nil
}

func (s *MenuServer) GetProduct(ctx context.Context, req *connect.Request[restaurantv1.GetProductRequest]) (*connect.Response[restaurantv1.GetProductResponse], error) {
	prod, err := s.menuRepo.GetProductByID(req.Msg.GetProductId())
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	return connect.NewResponse(&restaurantv1.GetProductResponse{
		Product: toProtoProduct(prod),
	}), nil
}

func (s *MenuServer) CreateProduct(ctx context.Context, req *connect.Request[restaurantv1.CreateProductRequest]) (*connect.Response[restaurantv1.CreateProductResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	var optGroups []models.CreateOptionGroupRequest
	for _, og := range req.Msg.GetOptions() {
		var opts []models.CreateOptionItemRequest
		for _, o := range og.GetOptions() {
			isAvail := o.GetIsAvailable()
			opts = append(opts, models.CreateOptionItemRequest{
				NameAr:       o.GetNameAr(),
				PriceDelta:   o.GetPriceModifier(),
				IsAvailable:  &isAvail,
				DisplayOrder: int(o.GetDisplayOrder()),
			})
		}
		minSel := int(og.GetMinSelection())
		maxSel := int(og.GetMaxSelection())
		optGroups = append(optGroups, models.CreateOptionGroupRequest{
			NameAr:        og.GetNameAr(),
			SelectionType: "MULTIPLE",
			IsRequired:    og.GetIsRequired(),
			MinSelections: &minSel,
			MaxSelections: &maxSel,
			DisplayOrder:  int(og.GetDisplayOrder()),
			Options:       opts,
		})
	}

	isAvail := req.Msg.GetIsAvailable()
	isFeatured := req.Msg.GetIsFeatured()
	prod, err := s.adminService.CreateProduct(claims, models.CreateProductRequest{
		CategoryID:   req.Msg.GetCategoryId(),
		NameAr:       req.Msg.GetNameAr(),
		NameEn:       req.Msg.GetNameEn(),
		Description:  req.Msg.GetDescription(),
		Price:        req.Msg.GetPrice(),
		ImageURL:     req.Msg.GetImageUrl(),
		IsAvailable:  &isAvail,
		IsFeatured:   &isFeatured,
		Badge:        req.Msg.GetBadge(),
		DisplayOrder: int(req.Msg.GetDisplayOrder()),
		Options:      optGroups,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.CreateProductResponse{
		Product: toProtoProduct(prod),
	}), nil
}

func (s *MenuServer) UpdateProduct(ctx context.Context, req *connect.Request[restaurantv1.UpdateProductRequest]) (*connect.Response[restaurantv1.UpdateProductResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	updateReq := models.UpdateProductRequest{
		CategoryID:  req.Msg.CategoryId,
		NameAr:      req.Msg.NameAr,
		NameEn:      req.Msg.NameEn,
		Description: req.Msg.Description,
		Price:       req.Msg.Price,
		ImageURL:    req.Msg.ImageUrl,
		IsAvailable: req.Msg.IsAvailable,
		IsFeatured:  req.Msg.IsFeatured,
		Badge:       req.Msg.Badge,
	}
	if req.Msg.DisplayOrder != nil {
		order := int(*req.Msg.DisplayOrder)
		updateReq.DisplayOrder = &order
	}

	prod, err := s.adminService.UpdateProduct(claims, req.Msg.GetId(), updateReq)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.UpdateProductResponse{
		Product: toProtoProduct(prod),
	}), nil
}

func (s *MenuServer) DeleteProduct(ctx context.Context, req *connect.Request[restaurantv1.DeleteProductRequest]) (*connect.Response[restaurantv1.DeleteProductResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	err = s.adminService.DeleteProduct(claims, req.Msg.GetId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.DeleteProductResponse{
		Success: true,
	}), nil
}

func (s *MenuServer) ToggleProductAvailability(ctx context.Context, req *connect.Request[restaurantv1.ToggleProductAvailabilityRequest]) (*connect.Response[restaurantv1.ToggleProductAvailabilityResponse], error) {
	claims, err := extractStaffClaims(ctx, req.Header(), s.authService, true)
	if err != nil {
		return nil, err
	}

	err = s.adminService.ToggleProductAvailability(claims, req.Msg.GetProductId(), req.Msg.GetIsAvailable())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&restaurantv1.ToggleProductAvailabilityResponse{
		ProductId:   req.Msg.GetProductId(),
		IsAvailable: req.Msg.GetIsAvailable(),
		Message:     "تم تحديث حالة توفر المنتج بنجاح",
		Success:     true,
	}), nil
}
