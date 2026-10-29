package services

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"smart-restaurant-api/internal/models"
	"smart-restaurant-api/internal/repositories"
)

type InventoryService struct {
	repo *repositories.InventoryRepository
}

func NewInventoryService(repo *repositories.InventoryRepository) *InventoryService {
	return &InventoryService{repo: repo}
}

// ----------------------------------------------------
// 1. INVENTORY ITEMS
// ----------------------------------------------------

func (s *InventoryService) CreateItem(restaurantID, actorID, actorName string, req models.CreateInventoryItemRequest) (*models.InventoryItem, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("اسم عنصر المخزون مطلوب")
	}

	if req.ItemType != models.ItemTypeRawIngredient && req.ItemType != models.ItemTypeFinishedGood {
		return nil, errors.New("نوع العنصر غير صالح: يجب أن يكون RAW_INGREDIENT أو FINISHED_GOOD")
	}

	baseUnit := strings.ToUpper(strings.TrimSpace(req.BaseUnit))
	if baseUnit == "" {
		return nil, errors.New("وحدة القياس الأساسية مطلوبة (مثال: KG, G, L, ML, PCS)")
	}

	if req.CostPerBaseUnit < 0 {
		return nil, errors.New("تكلفة وحدة القياس يجب أن تكون صفراً أو قيمة موجبة")
	}

	if req.MinimumStockQuantity < 0 {
		return nil, errors.New("حد إعادة الطلب (الحد الأدنى) لا يمكن أن يكون سالباً")
	}

	if req.InitialQuantity != nil && *req.InitialQuantity < 0 {
		return nil, errors.New("الكمية الافتتاحية للمخزون لا يمكن أن تكون سالبة")
	}

	itemID := fmt.Sprintf("inv_%s", uuid.New().String()[:8])
	item := &models.InventoryItem{
		ID:                   itemID,
		RestaurantID:         restaurantID,
		SKU:                  strings.TrimSpace(req.SKU),
		Name:                 name,
		NameEn:               strings.TrimSpace(req.NameEn),
		Description:          strings.TrimSpace(req.Description),
		ItemType:             req.ItemType,
		BaseUnit:             baseUnit,
		MinimumStockQuantity: req.MinimumStockQuantity,
		CostPerBaseUnit:      req.CostPerBaseUnit,
		IsActive:             true,
	}

	return s.repo.CreateItem(nil, item, req.InitialQuantity, actorID, actorName)
}

func (s *InventoryService) GetItem(restaurantID, itemID string) (*models.InventoryItem, error) {
	if strings.TrimSpace(itemID) == "" {
		return nil, errors.New("معرف العنصر مطلوب")
	}
	return s.repo.GetItemByID(restaurantID, itemID)
}

func (s *InventoryService) ListItems(restaurantID string, query models.InventoryItemFilterQuery) (*models.PaginatedInventoryItemsResponse, error) {
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 {
		query.PageSize = 20
	} else if query.PageSize > 100 {
		query.PageSize = 100
	}

	items, total, err := s.repo.ListItems(restaurantID, query)
	if err != nil {
		return nil, err
	}

	return &models.PaginatedInventoryItemsResponse{
		Items:      items,
		Total:      total,
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalPages: (total + query.PageSize - 1) / query.PageSize,
	}, nil
}

func (s *InventoryService) UpdateItem(restaurantID, itemID string, req models.UpdateInventoryItemRequest) (*models.InventoryItem, error) {
	if strings.TrimSpace(itemID) == "" {
		return nil, errors.New("معرف العنصر مطلوب")
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		return nil, errors.New("اسم العنصر لا يمكن أن يكون فارغاً")
	}

	if req.ItemType != nil && *req.ItemType != models.ItemTypeRawIngredient && *req.ItemType != models.ItemTypeFinishedGood {
		return nil, errors.New("نوع العنصر غير صالح: يجب أن يكون RAW_INGREDIENT أو FINISHED_GOOD")
	}

	if req.CostPerBaseUnit != nil && *req.CostPerBaseUnit < 0 {
		return nil, errors.New("تكلفة الوحدة لا يمكن أن تكون سالبة")
	}

	if req.MinimumStockQuantity != nil && *req.MinimumStockQuantity < 0 {
		return nil, errors.New("الحد الأدنى للمخزون لا يمكن أن يكون سالباً")
	}

	return s.repo.UpdateItem(restaurantID, itemID, req)
}

// ----------------------------------------------------
// 2. PURCHASE RECEIPTS
// ----------------------------------------------------

func (s *InventoryService) CreateReceipt(restaurantID, createdBy string, req models.CreatePurchaseReceiptRequest) (*models.PurchaseReceipt, error) {
	if strings.TrimSpace(req.ReceiptReference) == "" {
		return nil, errors.New("رقم مرجع إذن الاستلام مطلوب")
	}

	if len(req.Items) == 0 {
		return nil, errors.New("يجب إضافة بند واحد على الأقل في إذن الاستلام")
	}

	for idx, item := range req.Items {
		if strings.TrimSpace(item.InventoryItemID) == "" {
			return nil, fmt.Errorf("معرف عنصر المخزون مطلوب للبند رقم %d", idx+1)
		}
		if item.PurchaseQuantity <= 0 {
			return nil, fmt.Errorf("الكمية المشتراة للبند رقم %d يجب أن تكون أكبر من صفر", idx+1)
		}
		if item.ConversionFactor <= 0 {
			return nil, fmt.Errorf("معامل التحويل للبند رقم %d يجب أن يكون أكبر من صفر", idx+1)
		}
		if item.UnitCost < 0 {
			return nil, fmt.Errorf("سعر الوحدة للبند رقم %d لا يمكن أن يكون سالباً", idx+1)
		}
	}

	return s.repo.CreateReceipt(restaurantID, createdBy, req)
}

func (s *InventoryService) GetReceipt(restaurantID, receiptID string) (*models.PurchaseReceipt, error) {
	if strings.TrimSpace(receiptID) == "" {
		return nil, errors.New("معرف إذن الاستلام مطلوب")
	}
	return s.repo.GetReceiptByID(restaurantID, receiptID)
}

func (s *InventoryService) ListReceipts(restaurantID string, query models.ReceiptFilterQuery) (*models.PaginatedPurchaseReceiptsResponse, error) {
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 {
		query.PageSize = 20
	} else if query.PageSize > 100 {
		query.PageSize = 100
	}

	receipts, total, err := s.repo.ListReceipts(restaurantID, query)
	if err != nil {
		return nil, err
	}

	return &models.PaginatedPurchaseReceiptsResponse{
		Receipts:   receipts,
		Total:      total,
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalPages: (total + query.PageSize - 1) / query.PageSize,
	}, nil
}

func (s *InventoryService) ConfirmReceipt(restaurantID, receiptID, confirmedBy, confirmedByName string) (*models.PurchaseReceipt, error) {
	if strings.TrimSpace(receiptID) == "" {
		return nil, errors.New("معرف إذن الاستلام مطلوب")
	}
	return s.repo.ConfirmReceipt(restaurantID, receiptID, confirmedBy, confirmedByName)
}

// ----------------------------------------------------
// 3. INVENTORY ADJUSTMENTS
// ----------------------------------------------------

func (s *InventoryService) ApplyAdjustment(restaurantID, actorID, actorName string, req models.InventoryAdjustmentRequest) (*models.InventoryMovement, error) {
	if strings.TrimSpace(req.InventoryItemID) == "" {
		return nil, errors.New("معرف عنصر المخزون مطلوب")
	}

	adjType := strings.ToUpper(strings.TrimSpace(req.AdjustmentType))
	switch adjType {
	case "MANUAL_CONSUMPTION":
		if req.QuantityDelta <= 0 {
			return nil, errors.New("الكمية المستهلكة يدوياً يجب أن تكون أكبر من صفر")
		}
	case "WASTE":
		if req.QuantityDelta <= 0 {
			return nil, errors.New("كمية الهالك أو التالف يجب أن تكون أكبر من صفر")
		}
		if strings.TrimSpace(req.Reason) == "" {
			return nil, errors.New("سبب الهالك مطلوب (مثل: انتهاء صلاحية، كسر، تلف تخزين)")
		}
	case "STOCK_ADJUSTMENT":
		if req.QuantityDelta == 0 {
			return nil, errors.New("قيمة التسوية الجردية لا يمكن أن تكون صفراً")
		}
		if strings.TrimSpace(req.Reason) == "" {
			return nil, errors.New("سبب التسوية الجردية مطلوب وموثق")
		}
	case "PHYSICAL_STOCK_COUNT":
		if req.CountedQuantity < 0 {
			return nil, errors.New("الكمية الفعلية من واقع الجرد لا يمكن أن تكون سالبة")
		}
	default:
		return nil, fmt.Errorf("نوع الحركة غير صالح: %s", req.AdjustmentType)
	}

	req.AdjustmentType = adjType
	return s.repo.ApplyAdjustment(restaurantID, actorID, actorName, req)
}

// ----------------------------------------------------
// 4. RECIPES
// ----------------------------------------------------

func (s *InventoryService) GetRecipe(restaurantID, productID string) (*models.MenuItemRecipe, error) {
	if strings.TrimSpace(productID) == "" {
		return nil, errors.New("معرف المنتج مطلوب")
	}
	return s.repo.GetRecipeByProductID(restaurantID, productID)
}

func (s *InventoryService) ListRecipes(restaurantID string) ([]models.MenuItemRecipe, error) {
	return s.repo.ListRecipes(restaurantID)
}

func (s *InventoryService) SaveRecipe(restaurantID, productID string, req models.SaveRecipeRequest) (*models.MenuItemRecipe, error) {
	if strings.TrimSpace(productID) == "" {
		return nil, errors.New("معرف المنتج مطلوب")
	}

	if len(req.Ingredients) == 0 {
		return nil, errors.New("يجب إضافة مكون واحد على الأقل لوصفة المنتج")
	}

	for idx, ing := range req.Ingredients {
		if strings.TrimSpace(ing.InventoryItemID) == "" {
			return nil, fmt.Errorf("معرف عنصر المخزون مطلوب للمكون رقم %d", idx+1)
		}
		if ing.QuantityRequired <= 0 {
			return nil, fmt.Errorf("الكمية المطلوبة للمكون رقم %d يجب أن تكون أكبر من صفر", idx+1)
		}
	}

	return s.repo.SaveRecipe(restaurantID, productID, req)
}

// ----------------------------------------------------
// 5. MOVEMENTS & AUDIT LEDGER
// ----------------------------------------------------

func (s *InventoryService) ListMovements(restaurantID string, query models.InventoryMovementFilterQuery) (*models.PaginatedMovementsResponse, error) {
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 {
		query.PageSize = 20
	} else if query.PageSize > 100 {
		query.PageSize = 100
	}

	movements, total, err := s.repo.ListMovements(restaurantID, query)
	if err != nil {
		return nil, err
	}

	return &models.PaginatedMovementsResponse{
		Movements:  movements,
		Total:      total,
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalPages: (total + query.PageSize - 1) / query.PageSize,
	}, nil
}

// ----------------------------------------------------
// 6. SUMMARY & VALUATION
// ----------------------------------------------------

func (s *InventoryService) GetSummary(restaurantID string) (*models.InventorySummaryResponse, error) {
	return s.repo.GetInventorySummary(restaurantID)
}

// ----------------------------------------------------
// 7. ALERTS
// ----------------------------------------------------

func (s *InventoryService) ListAlerts(restaurantID string, query models.InventoryAlertFilterQuery) (*models.PaginatedAlertsResponse, error) {
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 {
		query.PageSize = 20
	} else if query.PageSize > 100 {
		query.PageSize = 100
	}

	alerts, total, err := s.repo.ListAlerts(restaurantID, query)
	if err != nil {
		return nil, err
	}

	return &models.PaginatedAlertsResponse{
		Alerts:     alerts,
		Total:      total,
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalPages: (total + query.PageSize - 1) / query.PageSize,
	}, nil
}

func (s *InventoryService) ResolveAlert(restaurantID, alertID, actorID string) error {
	if strings.TrimSpace(alertID) == "" {
		return errors.New("معرف التنبيه مطلوب")
	}
	return s.repo.UpdateAlertStatus(restaurantID, alertID, string(models.AlertStatusResolved), actorID)
}

// ----------------------------------------------------
// 8. ORDER ATOMIC INVENTORY DEDUCTION
// ----------------------------------------------------

func (s *InventoryService) DeductStockForOrderTx(
	tx *sql.Tx,
	order *models.Order,
	actorID, actorName, actorRole string,
	allowOverride bool,
	overrideReason string,
) error {
	shortages, err := s.repo.DeductStockForOrderTx(tx, order, actorID, actorName, actorRole, allowOverride, overrideReason)
	if err != nil {
		if len(shortages) > 0 {
			return &models.InventoryShortageError{
				Message:   "كمية المخزون غير كافية لتحضير هذا الطلب",
				Shortages: shortages,
			}
		}
		return err
	}
	return nil
}
