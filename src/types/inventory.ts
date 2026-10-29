/**
 * Inventory Management Models, Types, and DTOs
 * Strictly typed for Smart Restaurant Platform
 */

export type InventoryItemType = "RAW_INGREDIENT" | "FINISHED_GOOD";

export type InventoryBaseUnit = "g" | "kg" | "ml" | "l" | "piece";

export type InventoryPurchaseUnit = "g" | "kg" | "ml" | "l" | "piece" | "box" | "carton" | "sack" | "bottle" | "can";

export type ItemCategory =
  | "MEAT"
  | "POULTRY"
  | "VEGETABLES"
  | "DAIRY"
  | "DRY_GOODS"
  | "SPICES"
  | "BEVERAGES"
  | "BAKERY"
  | "PACKAGING"
  | "OTHER";

export interface InventoryItem {
  id: string;
  restaurantId: string;
  sku: string; // Internal barcode or inventory code
  nameAr: string;
  nameEn?: string;
  type: InventoryItemType;
  category: ItemCategory;
  baseUnit: InventoryBaseUnit;
  currentStock: number; // Strictly read-only from authoritative backend ledger
  minStockThreshold: number;
  costPerBaseUnit: number; // Cost in EGP per base unit
  isActive: boolean;
  purchaseUnit?: InventoryPurchaseUnit;
  conversionFactor?: number; // e.g. 1 carton = 24 pieces, or 1 sack = 25 kg
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryItemRequest {
  sku: string;
  nameAr: string;
  nameEn?: string;
  type: InventoryItemType;
  category: ItemCategory;
  baseUnit: InventoryBaseUnit;
  minStockThreshold: number;
  costPerBaseUnit?: number;
  isActive?: boolean;
  purchaseUnit?: InventoryPurchaseUnit;
  conversionFactor?: number;
  description?: string;
}

export interface UpdateInventoryItemRequest {
  nameAr?: string;
  nameEn?: string;
  category?: ItemCategory;
  minStockThreshold?: number;
  costPerBaseUnit?: number;
  isActive?: boolean;
  purchaseUnit?: InventoryPurchaseUnit;
  conversionFactor?: number;
  description?: string;
  // NOTE: currentStock is intentionally excluded. Stock cannot be directly edited!
}

// Purchase Receipts
export type PurchaseReceiptStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export interface PurchaseReceiptItem {
  id: string;
  itemId: string;
  itemSku?: string;
  itemNameAr: string;
  purchaseQty: number;
  purchaseUnit: InventoryPurchaseUnit;
  conversionFactor: number;
  baseQty: number; // purchaseQty * conversionFactor
  baseUnit: InventoryBaseUnit;
  unitCost: number; // Cost per purchase unit
  lineTotal: number; // purchaseQty * unitCost
}

export interface PurchaseReceipt {
  id: string;
  restaurantId: string;
  receiptNumber: string; // e.g. "PR-2026-001"
  supplierName?: string;
  invoiceNumber?: string;
  receiptDate: string;
  status: PurchaseReceiptStatus;
  items: PurchaseReceiptItem[];
  totalAmount: number;
  notes?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseReceiptItemRequest {
  itemId: string;
  purchaseQty: number;
  purchaseUnit: InventoryPurchaseUnit;
  conversionFactor: number;
  unitCost: number;
}

export interface CreatePurchaseReceiptRequest {
  supplierName?: string;
  invoiceNumber?: string;
  receiptDate: string;
  notes?: string;
  items: CreatePurchaseReceiptItemRequest[];
}

// Inventory Movements
export type MovementType =
  | "PURCHASE_RECEIPT"
  | "ORDER_CONSUMPTION"
  | "MANUAL_CONSUMPTION"
  | "WASTE"
  | "ADJUSTMENT"
  | "COUNT_RECONCILIATION";

export interface InventoryMovement {
  id: string;
  restaurantId: string;
  itemId: string;
  itemSku?: string;
  itemNameAr: string;
  movementType: MovementType;
  quantity: number; // Positive for additions, negative for deductions
  unit: InventoryBaseUnit;
  balanceBefore?: number;
  balanceAfter: number;
  referenceType?: "PURCHASE_RECEIPT" | "ORDER" | "MANUAL" | "STOCK_COUNT";
  referenceId?: string;
  reason: string;
  actor?: string; // Staff name or system
  timestamp: string; // ISO 8601
}

// Manual Stock Adjustment Request
export interface StockAdjustmentRequest {
  itemId: string;
  movementType: "MANUAL_CONSUMPTION" | "WASTE" | "ADJUSTMENT" | "COUNT_RECONCILIATION";
  quantity?: number; // Used for consumption, waste, or delta adjustment
  countedQuantity?: number; // Used for COUNT_RECONCILIATION
  unit: InventoryBaseUnit;
  reason: string; // Mandatory for auditability
  note?: string;
}

// Menu Recipes
export interface RecipeIngredient {
  itemId: string;
  itemNameAr: string;
  itemSku?: string;
  quantity: number;
  unit: InventoryBaseUnit;
  costEstimate?: number;
}

export interface MenuItemRecipe {
  menuItemId: string;
  menuItemNameAr: string;
  menuItemNameEn?: string;
  menuItemPrice?: number;
  categoryId?: string;
  categoryNameAr?: string;
  ingredients: RecipeIngredient[];
  totalEstimatedCost: number;
  isConfigured: boolean;
  notes?: string;
  updatedAt?: string;
}

export interface SaveRecipeRequest {
  menuItemId: string;
  ingredients: Array<{
    itemId: string;
    quantity: number;
    unit: InventoryBaseUnit;
  }>;
  notes?: string;
}

// Inventory Alerts
export type InventoryAlertType = "LOW_STOCK" | "OUT_OF_STOCK" | "NEGATIVE_STOCK";
export type InventoryAlertStatus = "ACTIVE" | "RESOLVED";

export interface InventoryAlert {
  id: string;
  restaurantId: string;
  itemId: string;
  itemNameAr: string;
  itemSku?: string;
  alertType: InventoryAlertType;
  currentBalance: number;
  minThreshold: number;
  unit: InventoryBaseUnit;
  status: InventoryAlertStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

// Low Stock Override
export interface StockOverrideRequest {
  orderId?: string;
  itemId: string;
  shortageQuantity: number;
  reason: string;
}

// Inventory Overview Metrics
export interface InventoryOverviewSummary {
  totalItemsCount: number;
  rawIngredientsCount: number;
  finishedGoodsCount: number;
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
  negativeStockItemsCount: number;
  estimatedInventoryValue: number;
  activeAlertsCount: number;
  recentMovementsCount: number;
  pendingDraftReceiptsCount: number;
}
