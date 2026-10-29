package services

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/repositories"
)

type AdminService struct {
	adminRepo *repositories.AdminRepository
}

func NewAdminService(adminRepo *repositories.AdminRepository) *AdminService {
	return &AdminService{
		adminRepo: adminRepo,
	}
}

// Helper to validate staff claims
func (s *AdminService) validateStaff(staff *Claims) error {
	if staff == nil || staff.RestaurantID == "" {
		return errors.New("غير مصرح: يجب تسجيل الدخول كمسؤول")
	}
	role := strings.ToUpper(strings.TrimSpace(staff.Role))
	if role != "ADMIN" && role != "OWNER" && role != "MANAGER" {
		return errors.New("ليس لديك الصلاحيات الكافية للقيام بهذا الإجراء")
	}
	return nil
}

// ==========================================
// 1. DASHBOARD & ANALYTICS
// ==========================================

func (s *AdminService) GetDashboardStats(staff *Claims) (*models.DashboardStatsResponse, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}
	return s.adminRepo.GetDashboardStats(staff.RestaurantID)
}

func (s *AdminService) GetAnalytics(staff *Claims, fromStr, toStr string) (*models.AnalyticsResponse, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	var from, to time.Time
	var err error

	if toStr != "" {
		if to, err = time.Parse(time.RFC3339, toStr); err != nil {
			if to, err = time.Parse("2006-01-02", toStr); err != nil {
				to = now
			} else {
				to = to.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			}
		}
	} else {
		to = now
	}

	if fromStr != "" {
		if from, err = time.Parse(time.RFC3339, fromStr); err != nil {
			if from, err = time.Parse("2006-01-02", fromStr); err != nil {
				from = to.AddDate(0, 0, -30)
			}
		}
	} else {
		from = to.AddDate(0, 0, -30) // Default last 30 days
	}

	if from.After(to) {
		from = to.AddDate(0, 0, -30)
	}

	return s.adminRepo.GetAnalytics(staff.RestaurantID, from, to)
}

// ==========================================
// 2. RESTAURANT SETTINGS
// ==========================================

func (s *AdminService) GetRestaurantSettings(staff *Claims) (*models.Restaurant, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}
	rest, err := s.adminRepo.GetRestaurantSettings(staff.RestaurantID)
	if err != nil {
		return nil, err
	}
	if rest == nil {
		return nil, errors.New("المطعم غير موجود")
	}
	return rest, nil
}

func (s *AdminService) UpdateRestaurantSettings(staff *Claims, req models.UpdateRestaurantSettingsRequest) (*models.Restaurant, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		return nil, errors.New("اسم المطعم مطلوب ولا يمكن تركه فارغاً")
	}
	if req.TaxRate != nil && (*req.TaxRate < 0 || *req.TaxRate > 100) {
		return nil, errors.New("نسبة الضريبة يجب أن تكون بين 0 و 100")
	}
	if req.ServiceFeeRate != nil && (*req.ServiceFeeRate < 0 || *req.ServiceFeeRate > 100) {
		return nil, errors.New("نسبة خدمة الصالة يجب أن تكون بين 0 و 100")
	}
	if req.EstimatedPreparationMinutes != nil && *req.EstimatedPreparationMinutes < 1 {
		return nil, errors.New("متوسط وقت التحضير يجب أن يكون دقيقة واحدة على الأقل")
	}

	return s.adminRepo.UpdateRestaurantSettings(staff.RestaurantID, req)
}

// ==========================================
// 3. CATEGORIES MANAGEMENT
// ==========================================

func (s *AdminService) ListCategories(staff *Claims) ([]models.AdminCategorySummary, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}
	return s.adminRepo.ListCategories(staff.RestaurantID)
}

func (s *AdminService) CreateCategory(staff *Claims, req models.CreateCategoryRequest) (*models.MenuCategory, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}

	nameAr := strings.TrimSpace(req.NameAr)
	if nameAr == "" {
		return nil, errors.New("اسم القسم باللغة العربية مطلوب")
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	cat := &models.MenuCategory{
		ID:           fmt.Sprintf("cat-%s", uuid.New().String()[:8]),
		RestaurantID: staff.RestaurantID,
		NameAr:       nameAr,
		NameEn:       strings.TrimSpace(req.NameEn),
		DisplayOrder: req.DisplayOrder,
		IsActive:     isActive,
		IconName:     strings.TrimSpace(req.IconName),
	}

	if err := s.adminRepo.CreateCategory(cat); err != nil {
		return nil, fmt.Errorf("خطأ أثناء إنشاء القسم: %w", err)
	}

	return s.adminRepo.GetCategoryByID(staff.RestaurantID, cat.ID)
}

func (s *AdminService) GetCategory(staff *Claims, categoryID string) (*models.MenuCategory, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}
	cat, err := s.adminRepo.GetCategoryByID(staff.RestaurantID, categoryID)
	if err != nil {
		return nil, err
	}
	if cat == nil {
		return nil, errors.New("القسم غير موجود")
	}
	return cat, nil
}

func (s *AdminService) UpdateCategory(staff *Claims, categoryID string, req models.UpdateCategoryRequest) (*models.MenuCategory, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}

	if req.NameAr != nil && strings.TrimSpace(*req.NameAr) == "" {
		return nil, errors.New("اسم القسم لا يمكن أن يكون فارغاً")
	}

	return s.adminRepo.UpdateCategory(staff.RestaurantID, categoryID, req)
}

func (s *AdminService) DeleteCategory(staff *Claims, categoryID string) error {
	if err := s.validateStaff(staff); err != nil {
		return err
	}
	return s.adminRepo.DeleteCategory(staff.RestaurantID, categoryID)
}

func (s *AdminService) ReorderCategories(staff *Claims, req models.ReorderCategoriesRequest) error {
	if err := s.validateStaff(staff); err != nil {
		return err
	}
	if len(req.Items) == 0 {
		return errors.New("قائمة الترتيب فارغة")
	}
	return s.adminRepo.ReorderCategories(staff.RestaurantID, req.Items)
}

// ==========================================
// 4. PRODUCT MANAGEMENT
// ==========================================

func (s *AdminService) ListProducts(staff *Claims, query models.ProductFilterQuery) (*models.PaginatedProductsResponse, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}

	products, total, err := s.adminRepo.ListProducts(staff.RestaurantID, query)
	if err != nil {
		return nil, err
	}

	pageSize := query.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	page := query.Page
	if page < 1 {
		page = 1
	}

	totalPages := (total + pageSize - 1) / pageSize
	if totalPages < 1 {
		totalPages = 1
	}

	return &models.PaginatedProductsResponse{
		Products:   products,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

func (s *AdminService) CreateProduct(staff *Claims, req models.CreateProductRequest) (*models.Product, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}

	nameAr := strings.TrimSpace(req.NameAr)
	if nameAr == "" {
		return nil, errors.New("اسم المنتج باللغة العربية مطلوب")
	}
	if req.Price < 0 {
		return nil, errors.New("سعر المنتج لا يمكن أن يكون سالباً")
	}
	if strings.TrimSpace(req.CategoryID) == "" {
		return nil, errors.New("يجب تحديد قسم للمنتج")
	}

	isAvail := true
	if req.IsAvailable != nil {
		isAvail = *req.IsAvailable
	}
	isFeat := false
	if req.IsFeatured != nil {
		isFeat = *req.IsFeatured
	}

	p := &models.Product{
		ID:           fmt.Sprintf("prod-%s", uuid.New().String()[:8]),
		RestaurantID: staff.RestaurantID,
		CategoryID:   strings.TrimSpace(req.CategoryID),
		NameAr:       nameAr,
		NameEn:       strings.TrimSpace(req.NameEn),
		Description:  strings.TrimSpace(req.Description),
		Price:        req.Price,
		ImageURL:     strings.TrimSpace(req.ImageURL),
		IsAvailable:  isAvail,
		IsFeatured:   isFeat,
		Badge:        strings.TrimSpace(req.Badge),
	}

	return s.adminRepo.CreateProduct(p, req.Options)
}

func (s *AdminService) GetProduct(staff *Claims, productID string) (*models.Product, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}
	p, err := s.adminRepo.GetProductByID(staff.RestaurantID, productID)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, errors.New("المنتج غير موجود")
	}
	return p, nil
}

func (s *AdminService) UpdateProduct(staff *Claims, productID string, req models.UpdateProductRequest) (*models.Product, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}

	if req.NameAr != nil && strings.TrimSpace(*req.NameAr) == "" {
		return nil, errors.New("اسم المنتج لا يمكن أن يكون فارغاً")
	}
	if req.Price != nil && *req.Price < 0 {
		return nil, errors.New("سعر المنتج لا يمكن أن يكون سالباً")
	}

	return s.adminRepo.UpdateProduct(staff.RestaurantID, productID, req)
}

func (s *AdminService) DeleteProduct(staff *Claims, productID string) error {
	if err := s.validateStaff(staff); err != nil {
		return err
	}
	return s.adminRepo.DeleteProduct(staff.RestaurantID, productID)
}

func (s *AdminService) ToggleProductAvailability(staff *Claims, productID string, isAvailable bool) error {
	if err := s.validateStaff(staff); err != nil {
		return err
	}
	return s.adminRepo.ToggleProductAvailability(staff.RestaurantID, productID, isAvailable)
}

// ==========================================
// 5. ORDERS INTEGRATION & LISTING
// ==========================================

func (s *AdminService) ListOrders(staff *Claims, query models.AdminOrderFilterQuery) (*models.PaginatedOrdersResponse, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}

	pageSize := query.PageSize
	if pageSize < 1 {
		pageSize = 12
	} else if pageSize > 100 {
		pageSize = 100
	}
	page := query.Page
	if page < 1 {
		page = 1
	}
	query.Page = page
	query.PageSize = pageSize

	orders, total, err := s.adminRepo.ListOrders(staff.RestaurantID, query)
	if err != nil {
		return nil, err
	}
	if orders == nil {
		orders = []models.Order{}
	}

	totalPages := 0
	if total > 0 {
		totalPages = (total + pageSize - 1) / pageSize
	}

	hasNextPage := page < totalPages
	hasPreviousPage := page > 1 && totalPages > 0

	pagination := models.PaginationMeta{
		Page:            page,
		PageSize:        pageSize,
		TotalItems:      total,
		TotalPages:      totalPages,
		HasNextPage:     hasNextPage,
		HasPreviousPage: hasPreviousPage,
	}

	return &models.PaginatedOrdersResponse{
		Data:       orders,
		Pagination: pagination,
		Orders:     orders,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

// ==========================================
// 6. PROMOTIONS
// ==========================================

func (s *AdminService) ListPromotions(staff *Claims) ([]models.Promotion, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}
	return s.adminRepo.ListPromotions(staff.RestaurantID)
}

func (s *AdminService) CreatePromotion(staff *Claims, req models.CreatePromotionRequest) (*models.Promotion, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}

	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code == "" {
		return nil, errors.New("كود العرض الترويجي مطلوب")
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, errors.New("عنوان العرض الترويجي مطلوب")
	}

	discType := strings.ToUpper(strings.TrimSpace(req.DiscountType))
	if discType != "PERCENTAGE" && discType != "FIXED" {
		return nil, errors.New("نوع الخصم يجب أن يكون إما PERCENTAGE أو FIXED")
	}

	if req.DiscountValue <= 0 {
		return nil, errors.New("قيمة الخصم يجب أن تكون أكبر من صفر")
	}
	if discType == "PERCENTAGE" && req.DiscountValue > 100 {
		return nil, errors.New("نسبة الخصم المئوية لا يمكن أن تتجاوز 100%")
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	promo := &models.Promotion{
		ID:                fmt.Sprintf("promo-%s", uuid.New().String()[:8]),
		RestaurantID:      staff.RestaurantID,
		Code:              code,
		Title:             title,
		DiscountType:      discType,
		DiscountValue:     req.DiscountValue,
		MinOrderAmount:    req.MinOrderAmount,
		MaxDiscountAmount: req.MaxDiscountAmount,
		StartDate:         req.StartDate,
		EndDate:           req.EndDate,
		IsActive:          isActive,
		UsageLimit:        req.UsageLimit,
	}

	if err := s.adminRepo.CreatePromotion(promo); err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate key") {
			return nil, errors.New("كود العرض الترويجي مسجل مسبقاً في هذا المطعم")
		}
		return nil, fmt.Errorf("خطأ أثناء إنشاء العرض الترويجي: %w", err)
	}

	return s.adminRepo.GetPromotionByID(staff.RestaurantID, promo.ID)
}

func (s *AdminService) GetPromotion(staff *Claims, promoID string) (*models.Promotion, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}
	p, err := s.adminRepo.GetPromotionByID(staff.RestaurantID, promoID)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, errors.New("العرض الترويجي غير موجود")
	}
	return p, nil
}

func (s *AdminService) UpdatePromotion(staff *Claims, promoID string, req models.UpdatePromotionRequest) (*models.Promotion, error) {
	if err := s.validateStaff(staff); err != nil {
		return nil, err
	}

	if req.DiscountType != nil {
		discType := strings.ToUpper(strings.TrimSpace(*req.DiscountType))
		if discType != "PERCENTAGE" && discType != "FIXED" {
			return nil, errors.New("نوع الخصم يجب أن يكون إما PERCENTAGE أو FIXED")
		}
	}
	if req.DiscountValue != nil && *req.DiscountValue <= 0 {
		return nil, errors.New("قيمة الخصم يجب أن تكون أكبر من صفر")
	}

	return s.adminRepo.UpdatePromotion(staff.RestaurantID, promoID, req)
}

func (s *AdminService) DeletePromotion(staff *Claims, promoID string) error {
	if err := s.validateStaff(staff); err != nil {
		return err
	}
	return s.adminRepo.DeletePromotion(staff.RestaurantID, promoID)
}
