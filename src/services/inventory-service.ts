import { apiClient } from "@/lib/api-client";
import {
  CreateInventoryItemRequest,
  CreatePurchaseReceiptRequest,
  InventoryAlert,
  InventoryAlertType,
  InventoryBaseUnit,
  InventoryItem,
  InventoryItemType,
  InventoryMovement,
  InventoryOverviewSummary,
  ItemCategory,
  MenuItemRecipe,
  MovementType,
  PurchaseReceipt,
  PurchaseReceiptStatus,
  SaveRecipeRequest,
  StockAdjustmentRequest,
  StockOverrideRequest,
  UpdateInventoryItemRequest,
} from "@/types/inventory";

export interface InventoryEndpointContract {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  endpoint: string;
  descriptionAr: string;
  status: "PENDING_BACKEND" | "PLANNED";
  samplePayload?: string;
  sampleResponse?: string;
}

export class InventoryService {
  // Session storage keys for local draft/state during development until backend implements migrations
  private itemsKey = "smart_admin_inventory_items_v1";
  private purchasesKey = "smart_admin_inventory_purchases_v1";
  private movementsKey = "smart_admin_inventory_movements_v1";
  private recipesKey = "smart_admin_inventory_recipes_v1";
  private alertsKey = "smart_admin_inventory_alerts_v1";

  // Initial seed data for Egyptian restaurant operations
  private getInitialItems(): InventoryItem[] {
    return [
      {
        id: "inv-01",
        restaurantId: "rest-01",
        sku: "RAW-MEAT-001",
        nameAr: "لحم كباب وكفتة بلدي مفروم ومتبل",
        nameEn: "Ground Beef for Kabab & Kofta",
        type: "RAW_INGREDIENT",
        category: "MEAT",
        baseUnit: "kg",
        currentStock: 4.5,
        minStockThreshold: 10.0,
        costPerBaseUnit: 350.0,
        isActive: true,
        purchaseUnit: "sack",
        conversionFactor: 20, // 1 sack = 20 kg
        description: "لحم بقري مفروم طازج متبل بالبصل والبهارات المصرية للمشويات",
        createdAt: "2026-10-27T10:00:00Z",
        updatedAt: "2026-10-27T10:00:00Z",
      },
      {
        id: "inv-02",
        restaurantId: "rest-01",
        sku: "RAW-POUL-002",
        nameAr: "صدور دجاج شيش طاووق مكعبات",
        nameEn: "Boneless Chicken Breast Cubes",
        type: "RAW_INGREDIENT",
        category: "POULTRY",
        baseUnit: "kg",
        currentStock: 18.0,
        minStockThreshold: 8.0,
        costPerBaseUnit: 180.0,
        isActive: true,
        purchaseUnit: "box",
        conversionFactor: 10, // 1 box = 10 kg
        description: "صدور دجاج طازجة مخلية مقطعة مكعبات للشيش طاووق",
        createdAt: "2026-10-27T10:00:00Z",
        updatedAt: "2026-10-27T10:00:00Z",
      },
      {
        id: "inv-03",
        restaurantId: "rest-01",
        sku: "RAW-DAIR-003",
        nameAr: "جبنة موتزاريلا طبيعي مبشورة",
        nameEn: "Shredded Mozzarella Cheese",
        type: "RAW_INGREDIENT",
        category: "DAIRY",
        baseUnit: "kg",
        currentStock: 1.2,
        minStockThreshold: 5.0,
        costPerBaseUnit: 220.0,
        isActive: true,
        purchaseUnit: "box",
        conversionFactor: 5,
        description: "جبنة موتزاريلا طبيعية تستخدم في الحواوشي المخصوص والفطائر",
        createdAt: "2026-10-27T10:00:00Z",
        updatedAt: "2026-10-27T10:00:00Z",
      },
      {
        id: "inv-04",
        restaurantId: "rest-01",
        sku: "RAW-DRY-004",
        nameAr: "أرز مصري حبة رفيعة ممتاز",
        nameEn: "Premium Egyptian Rice",
        type: "RAW_INGREDIENT",
        category: "DRY_GOODS",
        baseUnit: "kg",
        currentStock: 0.0, // Out of stock
        minStockThreshold: 15.0,
        costPerBaseUnit: 32.0,
        isActive: true,
        purchaseUnit: "sack",
        conversionFactor: 25, // 1 sack = 25 kg
        description: "أرز مصري فاخر لخلطة ورق العنب ووجبات المشويات",
        createdAt: "2026-10-27T10:00:00Z",
        updatedAt: "2026-10-27T10:00:00Z",
      },
      {
        id: "inv-05",
        restaurantId: "rest-01",
        sku: "RAW-DAIR-005",
        nameAr: "سمن بلدي بقري فلاحي صافي",
        nameEn: "Pure Clarified Ghee",
        type: "RAW_INGREDIENT",
        category: "DAIRY",
        baseUnit: "kg",
        currentStock: 12.0,
        minStockThreshold: 4.0,
        costPerBaseUnit: 280.0,
        isActive: true,
        purchaseUnit: "can",
        conversionFactor: 16,
        description: "سمن بلدي لتحضير الفطير المشلتت وطواجن الشوربة والبيض",
        createdAt: "2026-10-27T10:00:00Z",
        updatedAt: "2026-10-27T10:00:00Z",
      },
      {
        id: "inv-06",
        restaurantId: "rest-01",
        sku: "FIN-DRK-001",
        nameAr: "مياه معدنية طبيعية 600 مل",
        nameEn: "Natural Mineral Water 600ml",
        type: "FINISHED_GOOD",
        category: "BEVERAGES",
        baseUnit: "piece",
        currentStock: 8.0,
        minStockThreshold: 24.0,
        costPerBaseUnit: 6.0,
        isActive: true,
        purchaseUnit: "carton",
        conversionFactor: 24, // 1 carton = 24 bottles
        description: "زجاجات مياه شرب معدنية مباعة مباشرة للزبائن",
        createdAt: "2026-10-27T10:00:00Z",
        updatedAt: "2026-10-27T10:00:00Z",
      },
      {
        id: "inv-07",
        restaurantId: "rest-01",
        sku: "FIN-DRK-002",
        nameAr: "مشروب غازي كانز كوكاكولا 330 مل",
        nameEn: "Coca-Cola Can 330ml",
        type: "FINISHED_GOOD",
        category: "BEVERAGES",
        baseUnit: "piece",
        currentStock: 48.0,
        minStockThreshold: 24.0,
        costPerBaseUnit: 14.0,
        isActive: true,
        purchaseUnit: "carton",
        conversionFactor: 24,
        description: "كانز مشروبات غازية مباعة مباشرة للزبائن بالصالة",
        createdAt: "2026-10-27T10:00:00Z",
        updatedAt: "2026-10-27T10:00:00Z",
      },
    ];
  }

  private inMemoryStore = new Map<string, any>();

  private loadStored<T>(key: string, fallback: T): T {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(key);
        if (stored) return JSON.parse(stored);
      } catch {
        // fallback
      }
    } else {
      if (this.inMemoryStore.has(key)) {
        return JSON.parse(JSON.stringify(this.inMemoryStore.get(key)));
      }
    }
    return fallback;
  }

  private saveStored<T>(key: string, data: T): void {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(key, JSON.stringify(data));
      } catch {
        // ignore
      }
    } else {
      this.inMemoryStore.set(key, JSON.parse(JSON.stringify(data)));
    }
  }

  /**
   * Return formal contracts required for Go Backend
   */
  getMissingContracts(): InventoryEndpointContract[] {
    return [
      {
        method: "GET",
        endpoint: "/api/v1/admin/inventory/summary",
        descriptionAr: "إحصائيات ملخص المخزون وقيمة المواد الخام والمنتجات والتنبيهات المفتوحة",
        status: "PENDING_BACKEND",
        sampleResponse: JSON.stringify(
          {
            totalItemsCount: 7,
            rawIngredientsCount: 5,
            finishedGoodsCount: 2,
            lowStockItemsCount: 3,
            outOfStockItemsCount: 1,
            negativeStockItemsCount: 0,
            estimatedInventoryValue: 12450.0,
            activeAlertsCount: 4,
            recentMovementsCount: 15,
            pendingDraftReceiptsCount: 1,
          },
          null,
          2
        ),
      },
      {
        method: "GET",
        endpoint: "/api/v1/admin/inventory/items",
        descriptionAr: "استعراض أصناف المخزون مع التصفية والبحث والترقيم ورصيد كل صنف",
        status: "PENDING_BACKEND",
      },
      {
        method: "POST",
        endpoint: "/api/v1/admin/inventory/items",
        descriptionAr: "تسجيل صنف مخزون جديد (مادة خام أو منتج جاهز) مع ضبط معامل التحويل وحد الأمان",
        status: "PENDING_BACKEND",
      },
      {
        method: "POST",
        endpoint: "/api/v1/admin/inventory/purchases",
        descriptionAr: "إنشاء مسودة إذن استلام بضاعة ومشتريات (Draft Purchase Receipt) دون زيادة الرصيد",
        status: "PENDING_BACKEND",
      },
      {
        method: "POST",
        endpoint: "/api/v1/admin/inventory/purchases/:id/confirm",
        descriptionAr: "اعتماد إذن الاستلام نهائياً وتحديث أرصدة المخزون وتسجيل حركات التوريد تلقائياً",
        status: "PENDING_BACKEND",
      },
      {
        method: "GET",
        endpoint: "/api/v1/admin/inventory/movements",
        descriptionAr: "سجل حركات المخزون التاريخي غير القابل للتعديل (Read-only Movement Ledger)",
        status: "PENDING_BACKEND",
      },
      {
        method: "POST",
        endpoint: "/api/v1/admin/inventory/adjustments",
        descriptionAr: "تسجيل حركة استهلاك يدوي، هدر وتوالف، أو تسوية جرد فعلي دوري مع ذكر السبب الإجباري",
        status: "PENDING_BACKEND",
      },
      {
        method: "GET",
        endpoint: "/api/v1/admin/inventory/recipes",
        descriptionAr: "استرجاع معايير ووصفات قائمة الطعام والمكونات المخزنية المقابلة لكل وجبة",
        status: "PENDING_BACKEND",
      },
      {
        method: "PUT",
        endpoint: "/api/v1/admin/inventory/recipes/:menuItemId",
        descriptionAr: "حفظ وتعديل الوصفة ومقادير المكونات لوجبة محددة من منيو المطعم",
        status: "PENDING_BACKEND",
      },
      {
        method: "GET",
        endpoint: "/api/v1/admin/inventory/alerts",
        descriptionAr: "استرجاع تنبيهات انخفاض ونفاد المخزون والأرصدة السالبة",
        status: "PENDING_BACKEND",
      },
    ];
  }

  async checkContractStatus(endpoint: string): Promise<boolean> {
    try {
      await apiClient.get(endpoint);
      return true;
    } catch {
      return false;
    }
  }

  // Mapper helpers for backend API contracts
  private mapBackendItem(item: any): InventoryItem {
    return {
      id: item.id,
      restaurantId: item.restaurantId || "rest-01",
      sku: item.sku || "",
      nameAr: item.name || item.nameAr || "",
      nameEn: item.nameEn,
      type: (item.itemType || item.type || "RAW_INGREDIENT") as InventoryItemType,
      category: (item.category || "OTHER") as ItemCategory,
      baseUnit: (item.baseUnit || "kg") as InventoryBaseUnit,
      currentStock: item.quantityOnHand !== undefined ? item.quantityOnHand : (item.currentStock || 0),
      minStockThreshold: item.minimumStockQuantity !== undefined ? item.minimumStockQuantity : (item.minStockThreshold || 0),
      costPerBaseUnit: item.costPerBaseUnit || 0,
      isActive: item.isActive !== undefined ? item.isActive : true,
      purchaseUnit: item.purchaseUnit || item.baseUnit || "kg",
      conversionFactor: item.conversionFactor || 1,
      description: item.description,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
    };
  }

  private mapBackendReceipt(r: any): PurchaseReceipt {
    return {
      id: r.id,
      restaurantId: r.restaurantId || "rest-01",
      receiptNumber: r.receiptReference || r.id,
      supplierName: r.supplierName || "مورد",
      invoiceNumber: r.receiptReference,
      receiptDate: r.createdAt || new Date().toISOString(),
      status: r.status as PurchaseReceiptStatus,
      items: (r.items || []).map((it: any, idx: number) => ({
        id: it.id || `pri-${idx}`,
        itemId: it.inventoryItemId || it.itemId,
        itemSku: it.itemSku,
        itemNameAr: it.itemName || it.itemNameAr || "صنف مخزون",
        purchaseQty: it.purchaseQuantity || it.purchaseQty || 0,
        purchaseUnit: it.purchaseUnit || "kg",
        conversionFactor: it.conversionFactor || 1,
        baseQty: it.baseQuantity || it.baseQty || 0,
        baseUnit: it.baseUnit || "kg",
        unitCost: it.unitCost || 0,
        lineTotal: it.lineTotal || 0,
      })),
      totalAmount: r.totalCost || r.totalAmount || 0,
      notes: r.notes,
      confirmedAt: r.confirmedAt,
      confirmedBy: r.confirmedByName || r.confirmedBy,
      createdAt: r.createdAt || new Date().toISOString(),
      updatedAt: r.updatedAt || new Date().toISOString(),
    };
  }

  private mapBackendMovement(m: any): InventoryMovement {
    return {
      id: m.id,
      restaurantId: m.restaurantId || "rest-01",
      itemId: m.inventoryItemId || m.itemId,
      itemSku: m.itemSku,
      itemNameAr: m.itemName || m.itemNameAr || "صنف مخزون",
      movementType: m.movementType as MovementType,
      quantity: m.quantityDelta !== undefined ? m.quantityDelta : (m.quantity || 0),
      unit: (m.unit || "kg") as InventoryBaseUnit,
      balanceBefore: m.balanceBefore,
      balanceAfter: m.balanceAfter || 0,
      referenceType: (m.sourceType || m.referenceType) as any,
      referenceId: m.sourceId || m.referenceId,
      reason: m.reason || "",
      actor: m.actorName || m.actor || "النظام",
      timestamp: m.createdAt || m.timestamp || new Date().toISOString(),
    };
  }

  private mapBackendAlert(a: any): InventoryAlert {
    return {
      id: a.id,
      restaurantId: a.restaurantId || "rest-01",
      itemId: a.inventoryItemId || a.itemId,
      itemNameAr: a.itemName || a.itemNameAr || "صنف مخزون",
      itemSku: a.itemSku || "",
      alertType: a.alertType as InventoryAlertType,
      status: a.isResolved ? "RESOLVED" : (a.status || "ACTIVE"),
      currentBalance: a.currentBalance ?? a.currentStock ?? 0,
      minThreshold: a.minThreshold ?? a.threshold ?? 0,
      unit: (a.unit || "kg") as InventoryBaseUnit,
      createdAt: a.createdAt || new Date().toISOString(),
      resolvedAt: a.resolvedAt,
      resolvedBy: a.resolvedBy,
    };
  }

  private mapBackendRecipe(r: any): MenuItemRecipe {
    return {
      menuItemId: r.menuProductId || r.menuItemId,
      menuItemNameAr: r.productName || r.menuItemNameAr || "صنف قائمة",
      menuItemNameEn: r.menuItemNameEn,
      menuItemPrice: r.menuItemPrice || 0,
      categoryId: r.categoryId || "",
      categoryNameAr: r.categoryNameAr || "التصنيف",
      notes: r.instructions,
      ingredients: (r.ingredients || []).map((ing: any) => ({
        itemId: ing.inventoryItemId || ing.itemId,
        itemNameAr: ing.itemName || ing.itemNameAr || "مكون",
        itemSku: ing.itemSku,
        quantity: ing.quantityRequired !== undefined ? ing.quantityRequired : (ing.quantity || 0),
        unit: (ing.unit || "kg") as InventoryBaseUnit,
        costEstimate: ing.costEstimate || 0,
        applicableOptionId: ing.applicableOptionId,
      })),
      totalEstimatedCost: r.totalEstimatedCost || 0,
      isConfigured: (r.ingredients || []).length > 0,
      updatedAt: r.updatedAt || new Date().toISOString(),
    };
  }

  // --- 1. Summary ---
  async getSummary(): Promise<{ summary: InventoryOverviewSummary; isContractLive: boolean }> {
    try {
      const live = await apiClient.get<any>("/api/v1/admin/inventory/summary");
      const summary: InventoryOverviewSummary = {
        totalItemsCount: live.totalItems ?? live.totalItemsCount ?? 0,
        rawIngredientsCount: live.rawIngredientsCount ?? 0,
        finishedGoodsCount: live.finishedGoodsCount ?? 0,
        lowStockItemsCount: live.lowStockItems ?? live.lowStockItemsCount ?? 0,
        outOfStockItemsCount: live.outOfStockItems ?? live.outOfStockItemsCount ?? 0,
        negativeStockItemsCount: live.negativeStockItems ?? live.negativeStockItemsCount ?? 0,
        estimatedInventoryValue: live.totalValuation ?? live.estimatedInventoryValue ?? 0,
        activeAlertsCount: live.activeAlertsCount ?? 0,
        recentMovementsCount: live.recentMovements?.length ?? live.recentMovementsCount ?? 0,
        pendingDraftReceiptsCount: live.pendingDraftReceiptsCount ?? 0,
      };
      return { summary, isContractLive: true };
    } catch {
      const items = await this.getItems();
      const alerts = await this.getAlerts();
      const purchases = await this.getPurchases();
      const movements = await this.getMovements();

      const lowStock = items.filter((i) => i.currentStock > 0 && i.currentStock <= i.minStockThreshold).length;
      const outOfStock = items.filter((i) => i.currentStock <= 0).length;
      const negativeStock = items.filter((i) => i.currentStock < 0).length;
      const rawCount = items.filter((i) => i.type === "RAW_INGREDIENT").length;
      const finCount = items.filter((i) => i.type === "FINISHED_GOOD").length;
      const estValue = items.reduce((sum, i) => sum + Math.max(0, i.currentStock) * (i.costPerBaseUnit || 0), 0);
      const activeAlerts = alerts.filter((a) => a.status === "ACTIVE").length;
      const draftPurchases = purchases.filter((p) => p.status === "DRAFT").length;

      const summary: InventoryOverviewSummary = {
        totalItemsCount: items.length,
        rawIngredientsCount: rawCount,
        finishedGoodsCount: finCount,
        lowStockItemsCount: lowStock,
        outOfStockItemsCount: outOfStock,
        negativeStockItemsCount: negativeStock,
        estimatedInventoryValue: estValue,
        activeAlertsCount: activeAlerts,
        recentMovementsCount: movements.length,
        pendingDraftReceiptsCount: draftPurchases,
      };

      return { summary, isContractLive: false };
    }
  }

  // --- 2. Items CRUD ---
  async getItems(filters?: { type?: string; category?: string; stockStatus?: string; search?: string }): Promise<InventoryItem[]> {
    try {
      const res = await apiClient.get<any>("/api/v1/admin/inventory/items", filters as any);
      const list = Array.isArray(res) ? res : (res?.items || []);
      return list.map((i: any) => this.mapBackendItem(i));
    } catch {
      let items = this.loadStored<InventoryItem[]>(this.itemsKey, this.getInitialItems());

      if (filters?.type && filters.type !== "all") {
        items = items.filter((i) => i.type === filters.type);
      }
      if (filters?.category && filters.category !== "all") {
        items = items.filter((i) => i.category === filters.category);
      }
      if (filters?.stockStatus && filters.stockStatus !== "all") {
        if (filters.stockStatus === "low") {
          items = items.filter((i) => i.currentStock > 0 && i.currentStock <= i.minStockThreshold);
        } else if (filters.stockStatus === "out") {
          items = items.filter((i) => i.currentStock <= 0);
        } else if (filters.stockStatus === "available") {
          items = items.filter((i) => i.currentStock > i.minStockThreshold);
        }
      }
      if (filters?.search) {
        const q = filters.search.trim().toLowerCase();
        items = items.filter(
          (i) =>
            i.nameAr.toLowerCase().includes(q) ||
            (i.nameEn && i.nameEn.toLowerCase().includes(q)) ||
            i.sku.toLowerCase().includes(q)
        );
      }

      return items;
    }
  }

  async getItem(id: string): Promise<InventoryItem | null> {
    try {
      return await apiClient.get<InventoryItem>(`/api/v1/admin/inventory/items/${id}`);
    } catch {
      const items = await this.getItems();
      return items.find((i) => i.id === id) || null;
    }
  }

  async createItem(req: CreateInventoryItemRequest): Promise<{ item: InventoryItem; isContractLive: boolean }> {
    try {
      const live = await apiClient.post<InventoryItem>("/api/v1/admin/inventory/items", req);
      return { item: live, isContractLive: true };
    } catch {
      const items = this.loadStored<InventoryItem[]>(this.itemsKey, this.getInitialItems());
      const newItem: InventoryItem = {
        id: `inv-${Date.now()}`,
        restaurantId: "rest-01",
        sku: req.sku.trim().toUpperCase(),
        nameAr: req.nameAr.trim(),
        nameEn: req.nameEn?.trim(),
        type: req.type,
        category: req.category,
        baseUnit: req.baseUnit,
        currentStock: 0.0, // Strictly initial 0. Stock changes via purchase receipt or adjustment!
        minStockThreshold: req.minStockThreshold || 5,
        costPerBaseUnit: req.costPerBaseUnit || 0,
        isActive: req.isActive ?? true,
        purchaseUnit: req.purchaseUnit || req.baseUnit,
        conversionFactor: req.conversionFactor || 1,
        description: req.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      items.unshift(newItem);
      this.saveStored(this.itemsKey, items);
      return { item: newItem, isContractLive: false };
    }
  }

  async updateItem(id: string, req: UpdateInventoryItemRequest): Promise<{ item: InventoryItem; isContractLive: boolean }> {
    try {
      const live = await apiClient.patch<InventoryItem>(`/api/v1/admin/inventory/items/${id}`, req);
      return { item: live, isContractLive: true };
    } catch {
      const items = this.loadStored<InventoryItem[]>(this.itemsKey, this.getInitialItems());
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) throw new Error("الصنف المطلوب غير موجود");

      const existing = items[idx];
      const updated: InventoryItem = {
        ...existing,
        nameAr: req.nameAr ?? existing.nameAr,
        nameEn: req.nameEn ?? existing.nameEn,
        category: req.category ?? existing.category,
        minStockThreshold: req.minStockThreshold ?? existing.minStockThreshold,
        costPerBaseUnit: req.costPerBaseUnit ?? existing.costPerBaseUnit,
        isActive: req.isActive ?? existing.isActive,
        purchaseUnit: req.purchaseUnit ?? existing.purchaseUnit,
        conversionFactor: req.conversionFactor ?? existing.conversionFactor,
        description: req.description ?? existing.description,
        updatedAt: new Date().toISOString(),
      };

      items[idx] = updated;
      this.saveStored(this.itemsKey, items);
      return { item: updated, isContractLive: false };
    }
  }

  // --- 3. Purchase Receipts ---
  async getPurchases(filters?: { status?: string }): Promise<PurchaseReceipt[]> {
    try {
      const res = await apiClient.get<any>("/api/v1/admin/inventory/receipts", filters as any);
      const list = Array.isArray(res) ? res : (res?.receipts || []);
      return list.map((r: any) => this.mapBackendReceipt(r));
    } catch {
      const purchases = this.loadStored<PurchaseReceipt[]>(this.purchasesKey, [
        {
          id: "pr-01",
          restaurantId: "rest-01",
          receiptNumber: "PR-2026-001",
          supplierName: "مزارع الوادي للحوم والدواجن",
          invoiceNumber: "INV-88912",
          receiptDate: "2026-10-27T08:30:00Z",
          status: "CONFIRMED",
          items: [
            {
              id: "pri-01",
              itemId: "inv-02",
              itemSku: "RAW-POUL-002",
              itemNameAr: "صدور دجاج شيش طاووق مكعبات",
              purchaseQty: 2,
              purchaseUnit: "box",
              conversionFactor: 10,
              baseQty: 20, // 20 kg
              baseUnit: "kg",
              unitCost: 1750, // 1750 per box (175 per kg)
              lineTotal: 3500,
            },
          ],
          totalAmount: 3500,
          notes: "توريد أسبوعي للدواجن الطازجة",
          confirmedAt: "2026-10-27T08:45:00Z",
          confirmedBy: "المشرف العام (Admin)",
          createdAt: "2026-10-27T08:30:00Z",
          updatedAt: "2026-10-27T08:45:00Z",
        },
      ]);

      if (filters?.status && filters.status !== "all") {
        return purchases.filter((p) => p.status === filters.status);
      }
      return purchases;
    }
  }

  async getPurchase(id: string): Promise<PurchaseReceipt | null> {
    try {
      const live = await apiClient.get<any>(`/api/v1/admin/inventory/receipts/${id}`);
      return this.mapBackendReceipt(live);
    } catch {
      const purchases = await this.getPurchases();
      return purchases.find((p) => p.id === id) || null;
    }
  }

  async createPurchaseDraft(req: CreatePurchaseReceiptRequest): Promise<{ receipt: PurchaseReceipt; isContractLive: boolean }> {
    try {
      const backendPayload = {
        receiptReference: req.invoiceNumber || `PR-${Date.now()}`,
        supplierName: req.supplierName || "مورد عام",
        notes: req.notes || "",
        items: req.items.map((it) => ({
          inventoryItemId: it.itemId,
          purchaseQuantity: it.purchaseQty,
          purchaseUnit: it.purchaseUnit,
          conversionFactor: it.conversionFactor || 1,
          unitCost: it.unitCost,
        })),
      };
      const live = await apiClient.post<any>("/api/v1/admin/inventory/receipts", backendPayload);
      return { receipt: this.mapBackendReceipt(live), isContractLive: true };
    } catch {
      const itemsList = await this.getItems();
      const purchases = this.loadStored<PurchaseReceipt[]>(this.purchasesKey, []);

      const receiptItems = req.items.map((itemReq, idx) => {
        const invItem = itemsList.find((i) => i.id === itemReq.itemId);
        const factor = itemReq.conversionFactor || invItem?.conversionFactor || 1;
        const baseQty = itemReq.purchaseQty * factor;
        const lineTotal = itemReq.purchaseQty * itemReq.unitCost;

        return {
          id: `pri-${Date.now()}-${idx}`,
          itemId: itemReq.itemId,
          itemSku: invItem?.sku,
          itemNameAr: invItem?.nameAr || "صنف مخزون",
          purchaseQty: itemReq.purchaseQty,
          purchaseUnit: itemReq.purchaseUnit,
          conversionFactor: factor,
          baseQty,
          baseUnit: invItem?.baseUnit || "kg",
          unitCost: itemReq.unitCost,
          lineTotal,
        };
      });

      const totalAmount = receiptItems.reduce((sum, item) => sum + item.lineTotal, 0);

      const newReceipt: PurchaseReceipt = {
        id: `pr-${Date.now()}`,
        restaurantId: "rest-01",
        receiptNumber: `PR-2026-${String(purchases.length + 1).padStart(3, "0")}`,
        supplierName: req.supplierName || "مورد عام",
        invoiceNumber: req.invoiceNumber,
        receiptDate: req.receiptDate || new Date().toISOString(),
        status: "DRAFT", // Strict: always DRAFT on creation
        items: receiptItems,
        totalAmount,
        notes: req.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      purchases.unshift(newReceipt);
      this.saveStored(this.purchasesKey, purchases);
      return { receipt: newReceipt, isContractLive: false };
    }
  }

  async confirmPurchase(receiptId: string, actor: string = "المشرف العام"): Promise<{ receipt: PurchaseReceipt; isContractLive: boolean }> {
    try {
      const live = await apiClient.post<any>(`/api/v1/admin/inventory/receipts/${receiptId}/confirm`);
      return { receipt: this.mapBackendReceipt(live), isContractLive: true };
    } catch {
      const purchases = this.loadStored<PurchaseReceipt[]>(this.purchasesKey, []);
      const idx = purchases.findIndex((p) => p.id === receiptId);
      if (idx === -1) throw new Error("إذن التوريد غير موجود");

      const receipt = purchases[idx];
      if (receipt.status === "CONFIRMED") {
        throw new Error("تم اعتماد هذا الإذن مسبقاً بالفعل، لا يمكن تكرار الاعتماد");
      }

      // Update receipt status
      receipt.status = "CONFIRMED";
      receipt.confirmedAt = new Date().toISOString();
      receipt.confirmedBy = actor;
      receipt.updatedAt = new Date().toISOString();
      purchases[idx] = receipt;
      this.saveStored(this.purchasesKey, purchases);

      // Increase stock in inventory items & record movements
      const items = this.loadStored<InventoryItem[]>(this.itemsKey, this.getInitialItems());
      const movements = this.loadStored<InventoryMovement[]>(this.movementsKey, []);

      for (const pItem of receipt.items) {
        const itemIdx = items.findIndex((i) => i.id === pItem.itemId);
        if (itemIdx !== -1) {
          const before = items[itemIdx].currentStock;
          const after = Number((before + pItem.baseQty).toFixed(2));
          items[itemIdx].currentStock = after;
          items[itemIdx].updatedAt = new Date().toISOString();

          // Movement record
          movements.unshift({
            id: `mov-${Date.now()}-${pItem.itemId}`,
            restaurantId: "rest-01",
            itemId: pItem.itemId,
            itemSku: items[itemIdx].sku,
            itemNameAr: items[itemIdx].nameAr,
            movementType: "PURCHASE_RECEIPT",
            quantity: pItem.baseQty,
            unit: items[itemIdx].baseUnit,
            balanceBefore: before,
            balanceAfter: after,
            referenceType: "PURCHASE_RECEIPT",
            referenceId: receipt.receiptNumber,
            reason: `توريد بضاعة بفاتورة رقم ${receipt.invoiceNumber || receipt.receiptNumber} من ${receipt.supplierName || "المورد"}`,
            actor,
            timestamp: new Date().toISOString(),
          });
        }
      }

      this.saveStored(this.itemsKey, items);
      this.saveStored(this.movementsKey, movements);

      return { receipt, isContractLive: false };
    }
  }

  // --- 4. Movement History ---
  async getMovements(filters?: { itemId?: string; movementType?: string; search?: string }): Promise<InventoryMovement[]> {
    try {
      const res = await apiClient.get<any>("/api/v1/admin/inventory/movements", filters as any);
      const list = Array.isArray(res) ? res : (res?.movements || []);
      return list.map((m: any) => this.mapBackendMovement(m));
    } catch {
      let movements = this.loadStored<InventoryMovement[]>(this.movementsKey, [
        {
          id: "mov-01",
          restaurantId: "rest-01",
          itemId: "inv-01",
          itemSku: "RAW-MEAT-001",
          itemNameAr: "لحم كباب وكفتة بلدي مفروم ومتبل",
          movementType: "ORDER_CONSUMPTION",
          quantity: -0.4,
          unit: "kg",
          balanceBefore: 4.9,
          balanceAfter: 4.5,
          referenceType: "ORDER",
          referenceId: "ORD-1002",
          reason: "صرف تلقائي لبدء تجهيز طلب كباب وكفتة (PREPARING)",
          actor: "Order Engine (Kitchen)",
          timestamp: "2026-10-27T14:15:00Z",
        },
        {
          id: "mov-02",
          restaurantId: "rest-01",
          itemId: "inv-02",
          itemSku: "RAW-POUL-002",
          itemNameAr: "صدور دجاج شيش طاووق مكعبات",
          movementType: "PURCHASE_RECEIPT",
          quantity: 20.0,
          unit: "kg",
          balanceBefore: 0.0,
          balanceAfter: 20.0,
          referenceType: "PURCHASE_RECEIPT",
          referenceId: "PR-2026-001",
          reason: "توريد بضاعة بفاتورة رقم INV-88912 من مزارع الوادي",
          actor: "المشرف العام (Admin)",
          timestamp: "2026-10-27T08:45:00Z",
        },
      ]);

      if (filters?.itemId && filters.itemId !== "all") {
        movements = movements.filter((m) => m.itemId === filters.itemId);
      }
      if (filters?.movementType && filters.movementType !== "all") {
        movements = movements.filter((m) => m.movementType === filters.movementType);
      }
      if (filters?.search) {
        const q = filters.search.trim().toLowerCase();
        movements = movements.filter(
          (m) =>
            m.itemNameAr.toLowerCase().includes(q) ||
            (m.referenceId && m.referenceId.toLowerCase().includes(q)) ||
            (m.reason && m.reason.toLowerCase().includes(q))
        );
      }

      return movements;
    }
  }

  // --- 5. Manual Adjustments, Waste & Count Reconciliation ---
  async recordAdjustment(req: StockAdjustmentRequest, actor: string = "المشرف العام"): Promise<{ movement: InventoryMovement; isContractLive: boolean }> {
    try {
      const backendPayload = {
        inventoryItemId: req.itemId,
        adjustmentType: req.movementType === "COUNT_RECONCILIATION" ? "PHYSICAL_STOCK_COUNT" : req.movementType,
        quantityDelta: req.quantity || 0,
        countedQuantity: req.countedQuantity || 0,
        reason: req.reason,
        notes: req.note || "",
      };
      const live = await apiClient.post<any>("/api/v1/admin/inventory/adjustments", backendPayload);
      return { movement: this.mapBackendMovement(live), isContractLive: true };
    } catch {
      const items = this.loadStored<InventoryItem[]>(this.itemsKey, this.getInitialItems());
      const idx = items.findIndex((i) => i.id === req.itemId);
      if (idx === -1) throw new Error("صنف المخزون المحدد غير موجود");

      const item = items[idx];
      const before = item.currentStock;
      let delta = 0;
      let reasonText = req.reason.trim();

      if (req.movementType === "COUNT_RECONCILIATION") {
        if (req.countedQuantity === undefined || isNaN(req.countedQuantity)) {
          throw new Error("يرجى إدخال كمية الجرد الفعلي");
        }
        delta = Number((req.countedQuantity - before).toFixed(2));
        reasonText = `مطابقة جرد دوري: الفعلي (${req.countedQuantity}) مقابل الدفتري (${before}). السبب: ${req.reason}`;
      } else if (req.movementType === "WASTE") {
        if (!req.quantity || req.quantity <= 0) throw new Error("يرجى إدخال كمية الهدر الصالحة");
        delta = -Math.abs(req.quantity);
        reasonText = `تسجيل هدر وتالف: ${req.reason}`;
      } else if (req.movementType === "MANUAL_CONSUMPTION") {
        if (!req.quantity || req.quantity <= 0) throw new Error("يرجى إدخال كمية الاستهلاك");
        delta = -Math.abs(req.quantity);
        reasonText = `استهلاك تشغيلي يدوي: ${req.reason}`;
      } else {
        // ADJUSTMENT
        if (req.quantity === undefined || req.quantity === 0) throw new Error("يرجى إدخال كمية التسوية");
        delta = req.quantity;
        reasonText = `تسوية مخزنية: ${req.reason}`;
      }

      const after = Number((before + delta).toFixed(2));
      item.currentStock = after;
      item.updatedAt = new Date().toISOString();
      items[idx] = item;
      this.saveStored(this.itemsKey, items);

      // Record in ledger
      const movements = this.loadStored<InventoryMovement[]>(this.movementsKey, []);
      const newMovement: InventoryMovement = {
        id: `mov-${Date.now()}`,
        restaurantId: "rest-01",
        itemId: item.id,
        itemSku: item.sku,
        itemNameAr: item.nameAr,
        movementType: req.movementType,
        quantity: delta,
        unit: item.baseUnit,
        balanceBefore: before,
        balanceAfter: after,
        referenceType: req.movementType === "COUNT_RECONCILIATION" ? "STOCK_COUNT" : "MANUAL",
        referenceId: `ADJ-${Date.now().toString().slice(-6)}`,
        reason: reasonText + (req.note ? ` (${req.note})` : ""),
        actor,
        timestamp: new Date().toISOString(),
      };

      movements.unshift(newMovement);
      this.saveStored(this.movementsKey, movements);

      return { movement: newMovement, isContractLive: false };
    }
  }

  // --- 6. Menu Recipes ---
  async getRecipes(): Promise<MenuItemRecipe[]> {
    try {
      const res = await apiClient.get<any>("/api/v1/admin/inventory/recipes");
      const list = Array.isArray(res) ? res : (res?.recipes || []);
      return list.map((r: any) => this.mapBackendRecipe(r));
    } catch {
      return this.loadStored<MenuItemRecipe[]>(this.recipesKey, [
        {
          menuItemId: "prod-01",
          menuItemNameAr: "كباب وكفتة مشوية على الفحم",
          menuItemNameEn: "Charcoal Grilled Kabab & Kofta",
          menuItemPrice: 195.0,
          categoryId: "grills",
          categoryNameAr: "المشويات واللحوم",
          ingredients: [
            {
              itemId: "inv-01",
              itemNameAr: "لحم كباب وكفتة بلدي مفروم ومتبل",
              itemSku: "RAW-MEAT-001",
              quantity: 0.35, // 350 grams
              unit: "kg",
              costEstimate: 122.5,
            },
          ],
          totalEstimatedCost: 122.5,
          isConfigured: true,
          updatedAt: "2026-10-27T12:00:00Z",
        },
        {
          menuItemId: "prod-02",
          menuItemNameAr: "شيش طاووق متبل بالزبادي والأعشاب",
          menuItemNameEn: "Marinated Shish Tawook",
          menuItemPrice: 150.0,
          categoryId: "grills",
          categoryNameAr: "المشويات واللحوم",
          ingredients: [
            {
              itemId: "inv-02",
              itemNameAr: "صدور دجاج شيش طاووق مكعبات",
              itemSku: "RAW-POUL-002",
              quantity: 0.3, // 300 grams
              unit: "kg",
              costEstimate: 54.0,
            },
          ],
          totalEstimatedCost: 54.0,
          isConfigured: true,
          updatedAt: "2026-10-27T12:00:00Z",
        },
      ]);
    }
  }

  async getRecipe(menuItemId: string): Promise<MenuItemRecipe | null> {
    try {
      const res = await apiClient.get<any>(`/api/v1/admin/inventory/recipes/${menuItemId}`);
      return this.mapBackendRecipe(res);
    } catch {
      const recipes = await this.getRecipes();
      return recipes.find((r) => r.menuItemId === menuItemId) || null;
    }
  }

  async saveRecipe(menuItemId: string, req: SaveRecipeRequest): Promise<{ recipe: MenuItemRecipe; isContractLive: boolean }> {
    try {
      const backendPayload = {
        instructions: req.notes || "",
        ingredients: req.ingredients.map((ing) => ({
          inventoryItemId: ing.itemId,
          quantityRequired: ing.quantity,
          unit: ing.unit,
        })),
      };
      const live = await apiClient.put<any>(`/api/v1/admin/inventory/recipes/${menuItemId}`, backendPayload);
      return { recipe: this.mapBackendRecipe(live), isContractLive: true };
    } catch {
      const recipes = this.loadStored<MenuItemRecipe[]>(this.recipesKey, []);
      const items = await this.getItems();

      let totalCost = 0;
      const ingredients = req.ingredients.map((ing) => {
        const invItem = items.find((i) => i.id === ing.itemId);
        const costShare = (invItem?.costPerBaseUnit || 0) * ing.quantity;
        totalCost += costShare;
        return {
          itemId: ing.itemId,
          itemNameAr: invItem?.nameAr || "مكون",
          itemSku: invItem?.sku,
          quantity: ing.quantity,
          unit: ing.unit,
          costEstimate: Number(costShare.toFixed(2)),
        };
      });

      const updatedRecipe: MenuItemRecipe = {
        menuItemId,
        menuItemNameAr: "صنف منيو",
        ingredients,
        totalEstimatedCost: Number(totalCost.toFixed(2)),
        isConfigured: ingredients.length > 0,
        notes: req.notes,
        updatedAt: new Date().toISOString(),
      };

      const existingIdx = recipes.findIndex((r) => r.menuItemId === menuItemId);
      if (existingIdx !== -1) {
        recipes[existingIdx] = { ...recipes[existingIdx], ...updatedRecipe };
      } else {
        recipes.push(updatedRecipe);
      }

      this.saveStored(this.recipesKey, recipes);
      return { recipe: updatedRecipe, isContractLive: false };
    }
  }

  // --- 7. Alerts ---
  async getAlerts(filters?: { alertType?: string; status?: string }): Promise<InventoryAlert[]> {
    try {
      const res = await apiClient.get<any>("/api/v1/admin/inventory/alerts", filters as any);
      const list = Array.isArray(res) ? res : (res?.alerts || []);
      return list.map((a: any) => this.mapBackendAlert(a));
    } catch {
      const items = await this.getItems();
      // Generate active alerts dynamically from current item balances
      const alerts: InventoryAlert[] = [];

      items.forEach((item) => {
        if (item.currentStock < 0) {
          alerts.push({
            id: `alt-neg-${item.id}`,
            restaurantId: "rest-01",
            itemId: item.id,
            itemNameAr: item.nameAr,
            itemSku: item.sku,
            alertType: "NEGATIVE_STOCK",
            currentBalance: item.currentStock,
            minThreshold: item.minStockThreshold,
            unit: item.baseUnit,
            status: "ACTIVE",
            createdAt: new Date().toISOString(),
          });
        } else if (item.currentStock === 0) {
          alerts.push({
            id: `alt-out-${item.id}`,
            restaurantId: "rest-01",
            itemId: item.id,
            itemNameAr: item.nameAr,
            itemSku: item.sku,
            alertType: "OUT_OF_STOCK",
            currentBalance: item.currentStock,
            minThreshold: item.minStockThreshold,
            unit: item.baseUnit,
            status: "ACTIVE",
            createdAt: new Date().toISOString(),
          });
        } else if (item.currentStock <= item.minStockThreshold) {
          alerts.push({
            id: `alt-low-${item.id}`,
            restaurantId: "rest-01",
            itemId: item.id,
            itemNameAr: item.nameAr,
            itemSku: item.sku,
            alertType: "LOW_STOCK",
            currentBalance: item.currentStock,
            minThreshold: item.minStockThreshold,
            unit: item.baseUnit,
            status: "ACTIVE",
            createdAt: new Date().toISOString(),
          });
        }
      });

      if (filters?.alertType && filters.alertType !== "all") {
        return alerts.filter((a) => a.alertType === filters.alertType);
      }
      return alerts;
    }
  }

  async resolveAlert(id: string): Promise<{ success: boolean; isContractLive: boolean }> {
    try {
      await apiClient.patch(`/api/v1/admin/inventory/alerts/${id}`, { isResolved: true });
      return { success: true, isContractLive: true };
    } catch {
      return { success: true, isContractLive: false };
    }
  }

  // --- 8. Low Stock Override ---
  async requestStockOverride(req: StockOverrideRequest): Promise<{ success: boolean; message: string; isContractLive: boolean }> {
    try {
      const res = await apiClient.post<any>("/api/v1/admin/inventory/overrides", req);
      return { success: true, message: res.message || "تم اعتماد تجاوز المخزون بواسطة المشرف", isContractLive: true };
    } catch {
      if (!req.reason || req.reason.trim().length < 5) {
        throw new Error("يجب كتابة سبب تفصيلي معتمد لطلب تجاوز عجز المخزون");
      }
      return {
        success: true,
        message: `تم اعتماد إذن التجاوز بموجب الصلاحية الإدارية: ${req.reason}`,
        isContractLive: false,
      };
    }
  }
}

export const inventoryService = new InventoryService();
