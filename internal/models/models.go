package models

import "time"

type OrderStatus string

const (
	StatusNew       OrderStatus = "NEW"
	StatusConfirmed OrderStatus = "CONFIRMED"
	StatusPreparing OrderStatus = "PREPARING"
	StatusReady     OrderStatus = "READY"
	StatusServed    OrderStatus = "SERVED"
	StatusCancelled OrderStatus = "CANCELLED"
)

type OrderType string

const (
	OrderTypeDineIn   OrderType = "DINE_IN"
	OrderTypeTakeaway OrderType = "TAKEAWAY"
)

func (t OrderType) IsValid() bool {
	return t == OrderTypeDineIn || t == OrderTypeTakeaway
}

type PaymentStatus string

const (
	PaymentPending   PaymentStatus = "PENDING_CASHIER"
	PaymentPaid      PaymentStatus = "PAID"
	PaymentCancelled PaymentStatus = "CANCELLED"
)

type TableStatus string

const (
	TableStatusAvailable    TableStatus = "AVAILABLE"
	TableStatusOccupied     TableStatus = "OCCUPIED"
	TableStatusReserved     TableStatus = "RESERVED"
	TableStatusCleaning     TableStatus = "CLEANING"
	TableStatusOutOfService TableStatus = "OUT_OF_SERVICE"
)

type SessionStatus string

const (
	SessionStatusOpen   SessionStatus = "OPEN"
	SessionStatusClosed SessionStatus = "CLOSED"
)

// Restaurant models
type Restaurant struct {
	ID                          string    `json:"id"`
	Name                        string    `json:"name"`
	Slug                        string    `json:"slug"`
	Description                 string    `json:"description"`
	LogoURL                     string    `json:"logoUrl"`
	Currency                    string    `json:"currency"`
	IsOpen                      bool      `json:"isOpen"`
	EstimatedPreparationMinutes int       `json:"estimatedPreparationMinutes"`
	Phone                       string    `json:"phone,omitempty"`
	Address                     string    `json:"address,omitempty"`
	OpeningHours                string    `json:"openingHours,omitempty"`
	TaxRate                     float64   `json:"taxRate"`
	ServiceFeeRate              float64   `json:"serviceFeeRate"`
	CreatedAt                   time.Time `json:"createdAt"`
	UpdatedAt                   time.Time `json:"updatedAt"`
}

type Branch struct {
	ID           string    `json:"id"`
	RestaurantID string    `json:"restaurantId"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"createdAt"`
}

type TableSection struct {
	ID           string    `json:"id"`
	RestaurantID string    `json:"restaurantId"`
	BranchID     string    `json:"branchId,omitempty"`
	Name         string    `json:"name"`
	DisplayOrder int       `json:"displayOrder"`
	CreatedAt    time.Time `json:"createdAt"`
}

type TableSessionSummary struct {
	ID              string        `json:"id"`
	OpenedBy        string        `json:"openedBy,omitempty"`
	OpenedByName    string        `json:"openedByName,omitempty"`
	OpenedAt        string        `json:"openedAt"` // RFC3339
	ClosedBy        string        `json:"closedBy,omitempty"`
	ClosedByName    string        `json:"closedByName,omitempty"`
	ClosedAt        *string       `json:"closedAt,omitempty"`
	Status          SessionStatus `json:"status"`
	DurationMinutes int           `json:"durationMinutes"`
	Notes           string        `json:"notes,omitempty"`
	Total           float64       `json:"total"`
	Subtotal        float64       `json:"subtotal"`
	OrdersCount     int           `json:"ordersCount"`
}

type ActiveOrderSummary struct {
	ID          string      `json:"id"`
	OrderNumber string      `json:"orderNumber"`
	Status      OrderStatus `json:"status"`
	Total       float64     `json:"total"`
	ItemsCount  int         `json:"itemsCount"`
	CreatedAt   string      `json:"createdAt"` // RFC3339
}

type RestaurantTable struct {
	ID             string               `json:"id"`
	RestaurantID   string               `json:"restaurantId"`
	BranchID       string               `json:"branchId,omitempty"`
	TableNumber    string               `json:"tableNumber"`
	DisplayName    string               `json:"displayName"`
	Name           string               `json:"name"` // Alias for frontend backward compatibility
	Capacity       int                  `json:"capacity"`
	SectionID      *string              `json:"sectionId,omitempty"`
	SectionName    string               `json:"sectionName,omitempty"`
	Token          string               `json:"token"`
	Status         TableStatus          `json:"status"` // AVAILABLE, OCCUPIED, RESERVED, CLEANING, OUT_OF_SERVICE
	IsActive       bool                 `json:"isActive"`
	CurrentSession *TableSessionSummary `json:"currentSession,omitempty"`
	ActiveOrder    *ActiveOrderSummary  `json:"activeOrder,omitempty"`
	CreatedAt      time.Time            `json:"createdAt"`
	UpdatedAt      time.Time            `json:"updatedAt"`
}

type TableSession struct {
	ID              string        `json:"id"`
	RestaurantID    string        `json:"restaurantId"`
	BranchID        string        `json:"branchId,omitempty"`
	TableID         string        `json:"tableId"`
	TableNumber     string        `json:"tableNumber,omitempty"`
	TableName       string        `json:"tableName,omitempty"`
	TableStatus     TableStatus   `json:"tableStatus,omitempty"`
	OpenedBy        string        `json:"openedBy,omitempty"`
	OpenedByName    string        `json:"openedByName,omitempty"`
	OpenedAt        time.Time     `json:"openedAt"`
	ClosedBy        string        `json:"closedBy,omitempty"`
	ClosedByName    string        `json:"closedByName,omitempty"`
	ClosedAt        *time.Time    `json:"closedAt,omitempty"`
	Status          SessionStatus `json:"status"`
	Notes           string        `json:"notes,omitempty"`
	DurationMinutes int           `json:"durationMinutes"`
	Total           float64       `json:"total"`
	Subtotal        float64       `json:"subtotal"`
	UnpaidBalance   float64       `json:"unpaidBalance"`
	PaymentStatus   string        `json:"paymentStatus"`
	OrdersCount     int           `json:"ordersCount"`
	Orders          []Order       `json:"orders,omitempty"`
}

// Menu models
type MenuCategory struct {
	ID           string `json:"id"`
	RestaurantID string `json:"restaurantId"`
	NameAr       string `json:"nameAr"`
	NameEn       string `json:"nameEn,omitempty"`
	DisplayOrder int    `json:"displayOrder"`
	IsActive     bool   `json:"isActive"`
	IconName     string `json:"iconName,omitempty"`
}

type ProductOption struct {
	ID          string  `json:"id"`
	NameAr      string  `json:"nameAr"`
	PriceDelta  float64 `json:"priceDelta"`
	IsAvailable bool    `json:"isAvailable"`
}

type ProductOptionGroup struct {
	ID            string          `json:"id"`
	NameAr        string          `json:"nameAr"`
	SelectionType string          `json:"selectionType"` // "SINGLE" | "MULTIPLE"
	IsRequired    bool            `json:"isRequired"`
	MinSelections *int            `json:"minSelections,omitempty"`
	MaxSelections *int            `json:"maxSelections,omitempty"`
	Options       []ProductOption `json:"options"`
}

type Product struct {
	ID           string               `json:"id"`
	RestaurantID string               `json:"restaurantId"`
	CategoryID   string               `json:"categoryId"`
	NameAr       string               `json:"nameAr"`
	NameEn       string               `json:"nameEn,omitempty"`
	Description  string               `json:"description"`
	Price        float64              `json:"price"`
	ImageURL     string               `json:"imageUrl"`
	IsAvailable  bool                 `json:"isAvailable"`
	IsFeatured   bool                 `json:"isFeatured"`
	Badge        string               `json:"badge,omitempty"`
	Options      []ProductOptionGroup `json:"options"`
}

// Order models
type SelectedOptionSnapshot struct {
	GroupID      string  `json:"groupId"`
	GroupNameAr  string  `json:"groupNameAr"`
	OptionID     string  `json:"optionId"`
	OptionNameAr string  `json:"optionNameAr"`
	PriceDelta   float64 `json:"priceDelta"`
}

type OrderItem struct {
	ID                  string                   `json:"id"`
	ProductID           string                   `json:"productId"`
	ProductNameSnapshot string                   `json:"productNameSnapshot"`
	UnitPriceSnapshot   float64                  `json:"unitPriceSnapshot"`
	Quantity            int                      `json:"quantity"`
	SelectedOptions     []SelectedOptionSnapshot `json:"selectedOptions"`
	Notes               string                   `json:"notes,omitempty"`
	LineTotal           float64                  `json:"lineTotal"`
}

type OrderEvent struct {
	ID        string      `json:"id"`
	Timestamp string      `json:"timestamp"` // ISO 8601
	Status    OrderStatus `json:"status"`
	Actor     string      `json:"actor"`
	Note      string      `json:"note,omitempty"`
}

type Order struct {
	ID                 string        `json:"id"`
	OrderNumber        string        `json:"orderNumber"`
	OrderType          OrderType     `json:"orderType"`
	RestaurantID       string        `json:"restaurantId"`
	BranchID           string        `json:"branchId"`
	TableID            string        `json:"tableId"`
	TableName          string        `json:"tableName"`
	TableNameSnapshot  string        `json:"tableNameSnapshot"` // Compatibility alias
	SessionID          *string       `json:"sessionId,omitempty"`
	Status             OrderStatus   `json:"status"`
	Items              []OrderItem   `json:"items"`
	Subtotal           float64       `json:"subtotal"`
	Discount           float64       `json:"discount"`
	Tax                float64       `json:"tax"`
	Fee                float64       `json:"fee"`
	Total              float64       `json:"total"`
	PaymentStatus      PaymentStatus `json:"paymentStatus"`
	CreatedAt          string        `json:"createdAt"` // ISO 8601
	UpdatedAt          string        `json:"updatedAt"` // ISO 8601
	Events             []OrderEvent  `json:"events"`
	CancellationReason *string       `json:"cancellationReason,omitempty"`
	CancelledAt        *string       `json:"cancelledAt,omitempty"`
	CancelledBy        *string       `json:"cancelledBy,omitempty"`
	LatestActor        string        `json:"latestActor,omitempty"`
}

// Staff models
type StaffUser struct {
	ID           string    `json:"id"`
	RestaurantID string    `json:"restaurantId"`
	BranchID     string    `json:"branchId"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	Role         string    `json:"role"`
	IsActive     bool      `json:"isActive"`
	CreatedAt    time.Time `json:"createdAt"`
}

// DTOs
type CreateOrderItemOptionRequest struct {
	GroupID  string `json:"groupId"`
	OptionID string `json:"optionId"`
}

type CreateOrderItemRequest struct {
	ProductID       string                         `json:"productId" binding:"required"`
	Quantity        int                            `json:"quantity" binding:"required,min=1"`
	SelectedOptions []CreateOrderItemOptionRequest `json:"selectedOptions"`
	Notes           string                         `json:"notes"`
}

type CreateOrderRequest struct {
	OrderType         OrderType                `json:"orderType"`
	TableContextToken string                   `json:"tableContextToken"`
	TableToken        string                   `json:"tableToken"`
	RestaurantID      string                   `json:"restaurantId"`
	BranchID          string                   `json:"branchId"`
	TableID           string                   `json:"tableId"`
	TableNameSnapshot string                   `json:"tableNameSnapshot"`
	TableName         string                   `json:"tableName"`
	Items             []CreateOrderItemRequest `json:"items" binding:"required,min=1"`
	Notes             string                   `json:"notes"`
	ForceNewOrder     bool                     `json:"forceNewOrder"` // When true, forces creation of a separate order ticket even if latest is NEW
}

type UpdateStatusRequest struct {
	Status                OrderStatus `json:"status" binding:"required"`
	Actor                 string      `json:"actor"`
	Note                  string      `json:"note"`
	AllowLowStockOverride bool        `json:"allowLowStockOverride"`
	OverrideReason        string      `json:"overrideReason"`
}

type CancelOrderRequest struct {
	Reason string `json:"reason" binding:"required"`
	Actor  string `json:"actor"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string    `json:"token"`
	User  StaffUser `json:"user"`
}

// Table Management DTOs
type CreateTableRequest struct {
	TableNumber string `json:"tableNumber" binding:"required"`
	DisplayName string `json:"displayName"`
	Capacity    int    `json:"capacity" binding:"required,min=1"`
	SectionID   string `json:"sectionId"`
	BranchID    string `json:"branchId"`
}

type UpdateTableRequest struct {
	DisplayName *string      `json:"displayName"`
	Capacity    *int         `json:"capacity"`
	SectionID   *string      `json:"sectionId"`
	Status      *TableStatus `json:"status"`
}

type OpenSessionRequest struct {
	Notes string `json:"notes"`
}

type CloseSessionRequest struct {
	Override     bool   `json:"override"`
	Notes        string `json:"notes"`
	TargetStatus string `json:"targetStatus"` // "AVAILABLE" or "CLEANING"
}

type CreateSectionRequest struct {
	Name         string `json:"name" binding:"required"`
	BranchID     string `json:"branchId"`
	DisplayOrder int    `json:"displayOrder"`
}

type TableFilterQuery struct {
	Status    string `form:"status"`
	SectionID string `form:"sectionId"`
	Search    string `form:"search"`
	Page      int    `form:"page,default=1"`
	PageSize  int    `form:"pageSize,default=20"`
}

type PaginatedTablesResponse struct {
	Tables     []RestaurantTable `json:"tables"`
	Total      int               `json:"total"`
	Page       int               `json:"page"`
	PageSize   int               `json:"pageSize"`
	TotalPages int               `json:"totalPages"`
}

// Table Validation & QR DTOs
type TableValidationRequest struct {
	TableNumber string `json:"tableNumber" binding:"required"`
}

type RestaurantPublicInfo struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Currency    string `json:"currency"`
	LogoURL     string `json:"logoUrl"`
	Description string `json:"description"`
}

type TablePublicInfo struct {
	TableNumber string      `json:"tableNumber"`
	DisplayName string      `json:"displayName"`
	Capacity    int         `json:"capacity"`
	SectionName string      `json:"sectionName"`
	Status      TableStatus `json:"status"`
}

type TableValidationResponse struct {
	Success           bool                 `json:"success"`
	Restaurant        RestaurantPublicInfo `json:"restaurant"`
	Table             TablePublicInfo      `json:"table"`
	TableContextToken string               `json:"tableContextToken"`
	TableToken        string               `json:"tableToken"`
	CustomerURL       string               `json:"customerUrl"`
	ShortCustomerURL  string               `json:"shortCustomerUrl"`
	CanOrder          bool                 `json:"canOrder"`
	SessionID         *string              `json:"sessionId,omitempty"`
	ExpiresAt         string               `json:"expiresAt"` // RFC3339
	Message           string               `json:"message"`
}

type TableQRResponse struct {
	TableID          string `json:"tableId"`
	TableNumber      string `json:"tableNumber"`
	DisplayName      string `json:"displayName"`
	SectionName      string `json:"sectionName"`
	Token            string `json:"token"`
	CustomerURL      string `json:"customerUrl"`
	ShortCustomerURL string `json:"shortCustomerUrl"`
	RestaurantName   string `json:"restaurantName"`
	RestaurantSlug   string `json:"restaurantSlug"`
	BranchName       string `json:"branchName"`
	GeneratedAt      string `json:"generatedAt"`
}

// Promotions model
type Promotion struct {
	ID                string    `json:"id"`
	RestaurantID      string    `json:"restaurantId"`
	Code              string    `json:"code"`
	Title             string    `json:"title"`
	DiscountType      string    `json:"discountType"` // "PERCENTAGE" | "FIXED"
	DiscountValue     float64   `json:"discountValue"`
	MinOrderAmount    float64   `json:"minOrderAmount"`
	MaxDiscountAmount *float64  `json:"maxDiscountAmount,omitempty"`
	StartDate         *string   `json:"startDate,omitempty"`
	EndDate           *string   `json:"endDate,omitempty"`
	IsActive          bool      `json:"isActive"`
	UsageLimit        *int      `json:"usageLimit,omitempty"`
	TimesUsed         int       `json:"timesUsed"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

// Dashboard & Analytics DTOs
type StatusCount struct {
	Status OrderStatus `json:"status"`
	Count  int         `json:"count"`
	Total  float64     `json:"total"`
}

type BestSellerItem struct {
	ProductID     string  `json:"productId"`
	ProductName   string  `json:"productName"`
	TotalQuantity int     `json:"totalQuantity"`
	TotalRevenue  float64 `json:"totalRevenue"`
}

type TableOccupancyStats struct {
	TotalTables        int     `json:"totalTables"`
	AvailableTables    int     `json:"availableTables"`
	OccupiedTables     int     `json:"occupiedTables"`
	ReservedTables     int     `json:"reservedTables"`
	CleaningTables     int     `json:"cleaningTables"`
	OutOfServiceTables int     `json:"outOfServiceTables"`
	OccupancyRate      float64 `json:"occupancyRate"`
}

type DashboardStatsResponse struct {
	TodayOrderCount   int                 `json:"todayOrderCount"`
	TodaySales        float64             `json:"todaySales"`
	TotalSales        float64             `json:"totalSales"`
	AverageOrderValue float64             `json:"averageOrderValue"`
	OrdersByStatus    []StatusCount       `json:"ordersByStatus"`
	RecentOrders      []Order             `json:"recentOrders"`
	BestSellers       []BestSellerItem    `json:"bestSellers"`
	TableOccupancy    TableOccupancyStats `json:"tableOccupancy"`
	GeneratedAt       string              `json:"generatedAt"`
}

type DailySalesPoint struct {
	Date    string  `json:"date"`
	Revenue float64 `json:"revenue"`
	Orders  int     `json:"orders"`
}

type HourlyDistributionPoint struct {
	Hour   int `json:"hour"`
	Orders int `json:"orders"`
}

type CategoryRevenuePoint struct {
	CategoryID   string  `json:"categoryId"`
	CategoryName string  `json:"categoryName"`
	Revenue      float64 `json:"revenue"`
	ItemsSold    int     `json:"itemsSold"`
}

type AnalyticsResponse struct {
	From               string                    `json:"from"`
	To                 string                    `json:"to"`
	TotalRevenue       float64                   `json:"totalRevenue"`
	TotalOrders        int                       `json:"totalOrders"`
	AverageOrderValue  float64                   `json:"averageOrderValue"`
	ServedOrders       int                       `json:"servedOrders"`
	CancelledOrders    int                       `json:"cancelledOrders"`
	SalesTrend         []DailySalesPoint         `json:"salesTrend"`
	StatusDistribution []StatusCount             `json:"statusDistribution"`
	HourlyDistribution []HourlyDistributionPoint `json:"hourlyDistribution"`
	TopCategories      []CategoryRevenuePoint    `json:"topCategories"`
}

// Category & Product Admin DTOs
type AdminCategorySummary struct {
	MenuCategory
	ProductsCount int `json:"productsCount"`
}

type CreateCategoryRequest struct {
	NameAr       string `json:"nameAr" binding:"required"`
	NameEn       string `json:"nameEn"`
	DisplayOrder int    `json:"displayOrder"`
	IsActive     *bool  `json:"isActive"`
	IconName     string `json:"iconName"`
}

type UpdateCategoryRequest struct {
	NameAr       *string `json:"nameAr"`
	NameEn       *string `json:"nameEn"`
	DisplayOrder *int    `json:"displayOrder"`
	IsActive     *bool   `json:"isActive"`
	IconName     *string `json:"iconName"`
}

type ReorderCategoryItem struct {
	ID           string `json:"id" binding:"required"`
	DisplayOrder int    `json:"displayOrder"`
}

type ReorderCategoriesRequest struct {
	Items []ReorderCategoryItem `json:"items" binding:"required"`
}

type CreateOptionItemRequest struct {
	NameAr       string  `json:"nameAr" binding:"required"`
	PriceDelta   float64 `json:"priceDelta"`
	IsAvailable  *bool   `json:"isAvailable"`
	DisplayOrder int     `json:"displayOrder"`
}

type CreateOptionGroupRequest struct {
	NameAr        string                    `json:"nameAr" binding:"required"`
	SelectionType string                    `json:"selectionType" binding:"required"` // "SINGLE" | "MULTIPLE"
	IsRequired    bool                      `json:"isRequired"`
	MinSelections *int                      `json:"minSelections"`
	MaxSelections *int                      `json:"maxSelections"`
	DisplayOrder  int                       `json:"displayOrder"`
	Options       []CreateOptionItemRequest `json:"options"`
}

type CreateProductRequest struct {
	CategoryID   string                     `json:"categoryId" binding:"required"`
	NameAr       string                     `json:"nameAr" binding:"required"`
	NameEn       string                     `json:"nameEn"`
	Description  string                     `json:"description"`
	Price        float64                    `json:"price" binding:"required,min=0"`
	ImageURL     string                     `json:"imageUrl"`
	IsAvailable  *bool                      `json:"isAvailable"`
	IsFeatured   *bool                      `json:"isFeatured"`
	Badge        string                     `json:"badge"`
	DisplayOrder int                        `json:"displayOrder"`
	Options      []CreateOptionGroupRequest `json:"options"`
}

type UpdateProductRequest struct {
	CategoryID   *string                     `json:"categoryId"`
	NameAr       *string                     `json:"nameAr"`
	NameEn       *string                     `json:"nameEn"`
	Description  *string                     `json:"description"`
	Price        *float64                    `json:"price"`
	ImageURL     *string                     `json:"imageUrl"`
	IsAvailable  *bool                       `json:"isAvailable"`
	IsFeatured   *bool                       `json:"isFeatured"`
	Badge        *string                     `json:"badge"`
	DisplayOrder *int                        `json:"displayOrder"`
	Options      *[]CreateOptionGroupRequest `json:"options"`
}

type ToggleAvailabilityRequest struct {
	IsAvailable bool `json:"isAvailable"`
}

type PaginatedProductsResponse struct {
	Products   []Product `json:"products"`
	Total      int       `json:"total"`
	Page       int       `json:"page"`
	PageSize   int       `json:"pageSize"`
	TotalPages int       `json:"totalPages"`
}

type ProductFilterQuery struct {
	CategoryID  string `form:"categoryId"`
	Search      string `form:"search"`
	IsAvailable *bool  `form:"isAvailable"`
	Page        int    `form:"page,default=1"`
	PageSize    int    `form:"pageSize,default=20"`
}

// Restaurant Settings DTO
type UpdateRestaurantSettingsRequest struct {
	Name                        *string  `json:"name"`
	Description                 *string  `json:"description"`
	LogoURL                     *string  `json:"logoUrl"`
	Currency                    *string  `json:"currency"`
	IsOpen                      *bool    `json:"isOpen"`
	EstimatedPreparationMinutes *int     `json:"estimatedPreparationMinutes"`
	Phone                       *string  `json:"phone"`
	Address                     *string  `json:"address"`
	OpeningHours                *string  `json:"openingHours"`
	TaxRate                     *float64 `json:"taxRate"`
	ServiceFeeRate              *float64 `json:"serviceFeeRate"`
}

// Pagination metadata
type PaginationMeta struct {
	Page            int  `json:"page"`
	PageSize        int  `json:"pageSize"`
	TotalItems      int  `json:"totalItems"`
	TotalPages      int  `json:"totalPages"`
	HasNextPage     bool `json:"hasNextPage"`
	HasPreviousPage bool `json:"hasPreviousPage"`
}

// Admin Orders Filter & Paginated DTO
type AdminOrderFilterQuery struct {
	Status    string `form:"status"`
	OrderType string `form:"orderType"`
	From      string `form:"from"`
	To       string `form:"to"`
	Search   string `form:"search"`
	TableID  string `form:"tableId"`
	Sort     string `form:"sort"`
	Order    string `form:"order"`
	Page     int    `form:"page,default=1"`
	PageSize int    `form:"pageSize,default=12"`
}

type PaginatedOrdersResponse struct {
	Data       []Order        `json:"data"`
	Pagination PaginationMeta `json:"pagination"`
	// Backward compatibility fields:
	Orders     []Order        `json:"orders"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	PageSize   int            `json:"pageSize"`
	TotalPages int            `json:"totalPages"`
}

// Promotion DTOs
type CreatePromotionRequest struct {
	Code              string   `json:"code" binding:"required"`
	Title             string   `json:"title" binding:"required"`
	DiscountType      string   `json:"discountType" binding:"required"` // "PERCENTAGE" | "FIXED"
	DiscountValue     float64  `json:"discountValue" binding:"required,min=0"`
	MinOrderAmount    float64  `json:"minOrderAmount"`
	MaxDiscountAmount *float64 `json:"maxDiscountAmount"`
	StartDate         *string  `json:"startDate"`
	EndDate           *string  `json:"endDate"`
	IsActive          *bool    `json:"isActive"`
	UsageLimit        *int     `json:"usageLimit"`
}

type UpdatePromotionRequest struct {
	Title             *string  `json:"title"`
	DiscountType      *string  `json:"discountType"`
	DiscountValue     *float64 `json:"discountValue"`
	MinOrderAmount    *float64 `json:"minOrderAmount"`
	MaxDiscountAmount *float64 `json:"maxDiscountAmount"`
	StartDate         *string  `json:"startDate"`
	EndDate           *string  `json:"endDate"`
	IsActive          *bool    `json:"isActive"`
	UsageLimit        *int     `json:"usageLimit"`
}

// ==========================================
// INVENTORY MANAGEMENT MODELS & DTOS
// ==========================================

type InventoryItemType string

const (
	ItemTypeRawIngredient InventoryItemType = "RAW_INGREDIENT"
	ItemTypeFinishedGood  InventoryItemType = "FINISHED_GOOD"
)

type MovementType string

const (
	MovementPurchaseReceipt   MovementType = "PURCHASE_RECEIPT"
	MovementOrderConsumption  MovementType = "ORDER_CONSUMPTION"
	MovementManualConsumption MovementType = "MANUAL_CONSUMPTION"
	MovementWaste             MovementType = "WASTE"
	MovementStockAdjustment   MovementType = "STOCK_ADJUSTMENT"
	MovementReversal          MovementType = "REVERSAL"
)

type ReceiptStatus string

const (
	ReceiptStatusDraft     ReceiptStatus = "DRAFT"
	ReceiptStatusConfirmed ReceiptStatus = "CONFIRMED"
)

type AlertType string

const (
	AlertLowStock      AlertType = "LOW_STOCK"
	AlertOutOfStock    AlertType = "OUT_OF_STOCK"
	AlertNegativeStock AlertType = "NEGATIVE_STOCK"
)

type AlertStatus string

const (
	AlertStatusActive       AlertStatus = "ACTIVE"
	AlertStatusAcknowledged AlertStatus = "ACKNOWLEDGED"
	AlertStatusResolved     AlertStatus = "RESOLVED"
)

// InventoryItem represents a raw ingredient or finished good.
type InventoryItem struct {
	ID                   string            `json:"id"`
	RestaurantID         string            `json:"restaurantId"`
	SKU                  string            `json:"sku,omitempty"`
	Name                 string            `json:"name"`
	NameEn               string            `json:"nameEn,omitempty"`
	Description          string            `json:"description,omitempty"`
	ItemType             InventoryItemType `json:"itemType"`
	BaseUnit             string            `json:"baseUnit"`
	MinimumStockQuantity float64           `json:"minimumStockQuantity"`
	CostPerBaseUnit      float64           `json:"costPerBaseUnit"`
	QuantityOnHand       float64           `json:"quantityOnHand"`
	IsActive             bool              `json:"isActive"`
	CreatedAt            time.Time         `json:"createdAt"`
	UpdatedAt            time.Time         `json:"updatedAt"`
}

// InventoryBalance represents the single authoritative quantity on hand.
type InventoryBalance struct {
	InventoryItemID string    `json:"inventoryItemId"`
	RestaurantID    string    `json:"restaurantId"`
	QuantityOnHand  float64   `json:"quantityOnHand"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// InventoryMovement represents an immutable ledger entry of stock changes.
type InventoryMovement struct {
	ID              string       `json:"id"`
	RestaurantID    string       `json:"restaurantId"`
	InventoryItemID string       `json:"inventoryItemId"`
	ItemName        string       `json:"itemName,omitempty"`
	MovementType    MovementType `json:"movementType"`
	QuantityDelta   float64      `json:"quantityDelta"`
	BalanceBefore   float64      `json:"balanceBefore"`
	BalanceAfter    float64      `json:"balanceAfter"`
	UnitCost        float64      `json:"unitCost"`
	TotalCost       float64      `json:"totalCost"`
	SourceType      string       `json:"sourceType"`
	SourceID        string       `json:"sourceId,omitempty"`
	IdempotencyKey  string       `json:"idempotencyKey,omitempty"`
	Reason          string       `json:"reason,omitempty"`
	ActorUserID     string       `json:"actorUserId,omitempty"`
	ActorName       string       `json:"actorName,omitempty"`
	CreatedAt       string       `json:"createdAt"` // RFC3339
}

// PurchaseReceiptItem represents an item within a purchase receipt.
type PurchaseReceiptItem struct {
	ID                string  `json:"id"`
	PurchaseReceiptID string  `json:"purchaseReceiptId"`
	InventoryItemID   string  `json:"inventoryItemId"`
	ItemName          string  `json:"itemName,omitempty"`
	BaseUnit          string  `json:"baseUnit,omitempty"`
	PurchaseQuantity  float64 `json:"purchaseQuantity"`
	PurchaseUnit      string  `json:"purchaseUnit"`
	ConversionFactor  float64 `json:"conversionFactor"`
	BaseQuantity      float64 `json:"baseQuantity"`
	UnitCost          float64 `json:"unitCost"`
	LineTotal         float64 `json:"lineTotal"`
}

// PurchaseReceipt represents a supplier delivery/purchase document.
type PurchaseReceipt struct {
	ID               string                `json:"id"`
	RestaurantID     string                `json:"restaurantId"`
	ReceiptReference string                `json:"receiptReference"`
	SupplierName     string                `json:"supplierName,omitempty"`
	Status           ReceiptStatus         `json:"status"`
	TotalCost        float64               `json:"totalCost"`
	Notes            string                `json:"notes,omitempty"`
	CreatedBy        string                `json:"createdBy,omitempty"`
	CreatedByName    string                `json:"createdByName,omitempty"`
	ConfirmedBy      string                `json:"confirmedBy,omitempty"`
	ConfirmedByName  string                `json:"confirmedByName,omitempty"`
	CreatedAt        string                `json:"createdAt"`
	ConfirmedAt      *string               `json:"confirmedAt,omitempty"`
	Items            []PurchaseReceiptItem `json:"items"`
}

// RecipeIngredient links a recipe to an inventory ingredient.
type RecipeIngredient struct {
	ID                   string  `json:"id"`
	RecipeID             string  `json:"recipeId"`
	InventoryItemID      string  `json:"inventoryItemId"`
	ItemName             string  `json:"itemName,omitempty"`
	QuantityRequired     float64 `json:"quantityRequired"`
	Unit                 string  `json:"unit"`
	ApplicableOptionID   *string `json:"applicableOptionId,omitempty"`
	ApplicableOptionName string  `json:"applicableOptionName,omitempty"`
}

// MenuItemRecipe defines the ingredient bill-of-materials for a menu product.
type MenuItemRecipe struct {
	ID            string             `json:"id"`
	RestaurantID  string             `json:"restaurantId"`
	MenuProductID string             `json:"menuProductId"`
	ProductName   string             `json:"productName,omitempty"`
	Version       int                `json:"version"`
	IsActive      bool               `json:"isActive"`
	Instructions  string             `json:"instructions,omitempty"`
	CreatedAt     string             `json:"createdAt"`
	UpdatedAt     string             `json:"updatedAt"`
	Ingredients   []RecipeIngredient `json:"ingredients"`
}

// InventoryAlert represents a stock shortage or depletion alert.
type InventoryAlert struct {
	ID                string      `json:"id"`
	RestaurantID      string      `json:"restaurantId"`
	InventoryItemID   string      `json:"inventoryItemId"`
	ItemName          string      `json:"itemName,omitempty"`
	BaseUnit          string      `json:"baseUnit,omitempty"`
	AlertType         AlertType   `json:"alertType"`
	Status            AlertStatus `json:"status"`
	ThresholdQuantity float64     `json:"thresholdQuantity"`
	CurrentQuantity   float64     `json:"currentQuantity"`
	Message           string      `json:"message"`
	CreatedAt         string      `json:"createdAt"`
	AcknowledgedAt    *string     `json:"acknowledgedAt,omitempty"`
	AcknowledgedBy    *string     `json:"acknowledgedBy,omitempty"`
	ResolvedAt        *string     `json:"resolvedAt,omitempty"`
}

// StockShortage provides detailed shortage information when stock is insufficient.
type StockShortage struct {
	ItemID    string  `json:"itemId"`
	ItemName  string  `json:"itemName"`
	Required  float64 `json:"required"`
	Available float64 `json:"available"`
	Shortage  float64 `json:"shortage"`
	Unit      string  `json:"unit"`
}

type InventoryShortageError struct {
	Message   string          `json:"error"`
	Shortages []StockShortage `json:"shortages"`
}

func (e *InventoryShortageError) Error() string {
	return e.Message
}

// DTOs
type CreateInventoryItemRequest struct {
	SKU                  string            `json:"sku"`
	Name                 string            `json:"name" binding:"required"`
	NameEn               string            `json:"nameEn"`
	Description          string            `json:"description"`
	ItemType             InventoryItemType `json:"itemType" binding:"required"`
	BaseUnit             string            `json:"baseUnit" binding:"required"`
	MinimumStockQuantity float64           `json:"minimumStockQuantity"`
	CostPerBaseUnit      float64           `json:"costPerBaseUnit"`
	InitialQuantity      *float64          `json:"initialQuantity"`
}

type UpdateInventoryItemRequest struct {
	SKU                  *string            `json:"sku"`
	Name                 *string            `json:"name"`
	NameEn               *string            `json:"nameEn"`
	Description          *string            `json:"description"`
	ItemType             *InventoryItemType `json:"itemType"`
	BaseUnit             *string            `json:"baseUnit"`
	MinimumStockQuantity *float64           `json:"minimumStockQuantity"`
	CostPerBaseUnit      *float64           `json:"costPerBaseUnit"`
	IsActive             *bool              `json:"isActive"`
}

type InventoryItemFilterQuery struct {
	Search       string `form:"search"`
	ItemType     string `form:"itemType"`
	IsActive     *bool  `form:"isActive"`
	LowStockOnly *bool  `form:"lowStockOnly"`
	Page         int    `form:"page,default=1"`
	PageSize     int    `form:"pageSize,default=20"`
}

type PaginatedInventoryItemsResponse struct {
	Items      []InventoryItem `json:"items"`
	Total      int             `json:"total"`
	Page       int             `json:"page"`
	PageSize   int             `json:"pageSize"`
	TotalPages int             `json:"totalPages"`
}

type CreatePurchaseReceiptItemRequest struct {
	InventoryItemID  string  `json:"inventoryItemId" binding:"required"`
	PurchaseQuantity float64 `json:"purchaseQuantity" binding:"required,gt=0"`
	PurchaseUnit     string  `json:"purchaseUnit" binding:"required"`
	ConversionFactor float64 `json:"conversionFactor" binding:"required,gt=0"`
	UnitCost         float64 `json:"unitCost" binding:"gte=0"`
}

type CreatePurchaseReceiptRequest struct {
	ReceiptReference string                             `json:"receiptReference" binding:"required"`
	SupplierName     string                             `json:"supplierName"`
	Notes            string                             `json:"notes"`
	Items            []CreatePurchaseReceiptItemRequest `json:"items" binding:"required,min=1"`
}

type ReceiptFilterQuery struct {
	Status   string `form:"status"`
	Search   string `form:"search"`
	From     string `form:"from"`
	To       string `form:"to"`
	Page     int    `form:"page,default=1"`
	PageSize int    `form:"pageSize,default=20"`
}

type PaginatedPurchaseReceiptsResponse struct {
	Receipts   []PurchaseReceipt `json:"receipts"`
	Total      int               `json:"total"`
	Page       int               `json:"page"`
	PageSize   int               `json:"pageSize"`
	TotalPages int               `json:"totalPages"`
}

type InventoryAdjustmentRequest struct {
	InventoryItemID string  `json:"inventoryItemId" binding:"required"`
	AdjustmentType  string  `json:"adjustmentType" binding:"required"` // "MANUAL_CONSUMPTION", "WASTE", "STOCK_ADJUSTMENT", "PHYSICAL_STOCK_COUNT"
	QuantityDelta   float64 `json:"quantityDelta"`
	CountedQuantity float64 `json:"countedQuantity"`
	Reason          string  `json:"reason"`
	Notes           string  `json:"notes"`
}

type CreateRecipeIngredientRequest struct {
	InventoryItemID    string  `json:"inventoryItemId" binding:"required"`
	QuantityRequired   float64 `json:"quantityRequired" binding:"required,gt=0"`
	Unit               string  `json:"unit" binding:"required"`
	ApplicableOptionID *string `json:"applicableOptionId"`
}

type SaveRecipeRequest struct {
	Instructions string                          `json:"instructions"`
	Ingredients  []CreateRecipeIngredientRequest `json:"ingredients" binding:"required,min=1"`
}

type InventoryMovementFilterQuery struct {
	InventoryItemID string `form:"inventoryItemId"`
	MovementType    string `form:"movementType"`
	From            string `form:"from"`
	To              string `form:"to"`
	Page            int    `form:"page,default=1"`
	PageSize        int    `form:"pageSize,default=20"`
}

type PaginatedMovementsResponse struct {
	Movements  []InventoryMovement `json:"movements"`
	Total      int                 `json:"total"`
	Page       int                 `json:"page"`
	PageSize   int                 `json:"pageSize"`
	TotalPages int                 `json:"totalPages"`
}

type InventorySummaryResponse struct {
	TotalItems         int                 `json:"totalItems"`
	LowStockItems      int                 `json:"lowStockItems"`
	OutOfStockItems    int                 `json:"outOfStockItems"`
	NegativeStockItems int                 `json:"negativeStockItems"`
	TotalValuation     float64             `json:"totalValuation"`
	RecentMovements    []InventoryMovement `json:"recentMovements"`
	ActiveAlertsCount  int                 `json:"activeAlertsCount"`
	GeneratedAt        string              `json:"generatedAt"`
}

type InventoryAlertFilterQuery struct {
	Status    string `form:"status"`
	AlertType string `form:"alertType"`
	Page      int    `form:"page,default=1"`
	PageSize  int    `form:"pageSize,default=20"`
}

type PaginatedAlertsResponse struct {
	Alerts     []InventoryAlert `json:"alerts"`
	Total      int              `json:"total"`
	Page       int              `json:"page"`
	PageSize   int              `json:"pageSize"`
	TotalPages int              `json:"totalPages"`
}

type UpdateAlertRequest struct {
	Status string `json:"status" binding:"required"` // "ACKNOWLEDGED" | "RESOLVED"
	Note   string `json:"note"`
}



