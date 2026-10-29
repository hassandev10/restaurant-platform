/**
 * Missing / Proposed Backend Contracts Specifications
 * 
 * Strict Rule: Never invent API endpoints or backend response structures without 
 * explicit typed service interfaces and clear documentation of the required contracts.
 */

// 1. Analytics Contracts (Planned for Go Backend)
export interface AnalyticsOverviewMetrics {
  totalRevenue: number;
  ordersCount: number;
  averageOrderValue: number;
  occupiedTablesCount: number;
  totalTablesCount: number;
  cancellationRate: number;
  periodStart: string;
  periodEnd: string;
}

export interface RevenueSeriesPoint {
  date: string;
  revenue: number;
  ordersCount: number;
}

export interface CategorySalesBreakdown {
  categoryId: string;
  categoryNameAr: string;
  totalSales: number;
  quantitySold: number;
  percentage: number;
}

export interface IAnalyticsService {
  /**
   * Proposed Endpoint: GET /api/v1/admin/analytics/overview?period=today|week|month
   */
  getOverviewMetrics(period: "today" | "week" | "month"): Promise<AnalyticsOverviewMetrics>;

  /**
   * Proposed Endpoint: GET /api/v1/admin/analytics/revenue-series?from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  getRevenueSeries(from: string, to: string): Promise<RevenueSeriesPoint[]>;

  /**
   * Proposed Endpoint: GET /api/v1/admin/analytics/categories
   */
  getCategoryBreakdown(): Promise<CategorySalesBreakdown[]>;
}

// 2. Promotions & Coupons Contracts (Planned for Go Backend)
export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export interface Promotion {
  id: string;
  restaurantId: string;
  code: string;
  titleAr: string;
  descriptionAr?: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderTotal?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreatePromotionRequest {
  code: string;
  titleAr: string;
  descriptionAr?: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderTotal?: number;
  maxDiscount?: number;
  usageLimit?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface IPromotionsService {
  /**
   * Proposed Endpoint: GET /api/v1/admin/promotions
   */
  listPromotions(): Promise<Promotion[]>;

  /**
   * Proposed Endpoint: POST /api/v1/admin/promotions
   */
  createPromotion(req: CreatePromotionRequest): Promise<Promotion>;

  /**
   * Proposed Endpoint: PATCH /api/v1/admin/promotions/:id/status
   */
  togglePromotion(id: string, isActive: boolean): Promise<Promotion>;

  /**
   * Proposed Endpoint: DELETE /api/v1/admin/promotions/:id
   */
  deletePromotion(id: string): Promise<void>;
}

// 3. Menu Mutations Contracts (Proposed Go Backend endpoints)
export interface IMenuMutationService {
  /**
   * Proposed Endpoint: POST /api/v1/admin/products
   */
  createProduct(req: any): Promise<any>;

  /**
   * Proposed Endpoint: PATCH /api/v1/admin/products/:productId
   */
  updateProduct(productId: string, req: any): Promise<any>;

  /**
   * Proposed Endpoint: DELETE /api/v1/admin/products/:productId
   */
  deleteProduct(productId: string): Promise<void>;

  /**
   * Proposed Endpoint: PATCH /api/v1/admin/products/:productId/availability
   */
  toggleProductAvailability(productId: string, isAvailable: boolean): Promise<any>;

  /**
   * Proposed Endpoint: POST /api/v1/admin/upload
   */
  uploadProductImage(file: File): Promise<{ url: string }>;
}

// 4. Inventory Management Contracts (Planned for Go Backend)
export interface IInventoryServiceContract {
  /**
   * Proposed Endpoint: GET /api/v1/admin/inventory/summary
   */
  getSummary(): Promise<any>;

  /**
   * Proposed Endpoint: GET /api/v1/admin/inventory/items
   */
  getItems(filters?: any): Promise<any>;

  /**
   * Proposed Endpoint: POST /api/v1/admin/inventory/items
   */
  createItem(data: any): Promise<any>;

  /**
   * Proposed Endpoint: GET /api/v1/admin/inventory/items/:id
   */
  getItem(id: string): Promise<any>;

  /**
   * Proposed Endpoint: PATCH /api/v1/admin/inventory/items/:id
   */
  updateItem(id: string, data: any): Promise<any>;

  /**
   * Proposed Endpoint: GET /api/v1/admin/inventory/purchases
   */
  getPurchases(filters?: any): Promise<any>;

  /**
   * Proposed Endpoint: POST /api/v1/admin/inventory/purchases
   */
  createPurchaseDraft(data: any): Promise<any>;

  /**
   * Proposed Endpoint: POST /api/v1/admin/inventory/purchases/:id/confirm
   */
  confirmPurchase(id: string): Promise<any>;

  /**
   * Proposed Endpoint: GET /api/v1/admin/inventory/movements
   */
  getMovements(filters?: any): Promise<any>;

  /**
   * Proposed Endpoint: POST /api/v1/admin/inventory/adjustments
   */
  recordAdjustment(data: any): Promise<any>;

  /**
   * Proposed Endpoint: GET /api/v1/admin/inventory/recipes
   */
  getRecipes(): Promise<any>;

  /**
   * Proposed Endpoint: GET /api/v1/admin/inventory/recipes/:menuItemId
   */
  getRecipe(menuItemId: string): Promise<any>;

  /**
   * Proposed Endpoint: PUT /api/v1/admin/inventory/recipes/:menuItemId
   */
  saveRecipe(menuItemId: string, data: any): Promise<any>;

  /**
   * Proposed Endpoint: GET /api/v1/admin/inventory/alerts
   */
  getAlerts(filters?: any): Promise<any>;

  /**
   * Proposed Endpoint: POST /api/v1/admin/inventory/alerts/:id/resolve
   */
  resolveAlert(id: string): Promise<any>;

  /**
   * Proposed Endpoint: POST /api/v1/admin/inventory/overrides
   */
  requestStockOverride(data: any): Promise<any>;
}
