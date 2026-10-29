import { apiClient } from "@/lib/api-client";
import { CreatePromotionRequest, IPromotionsService, Promotion } from "@/types/contracts";

export interface PromotionEndpointContract {
  method: string;
  endpoint: string;
  descriptionAr: string;
  expectedPayload?: string;
  expectedResponse?: string;
}

export class PromotionsService implements IPromotionsService {
  private mapBackendPromotion(p: any): Promotion {
    return {
      id: p.id,
      restaurantId: p.restaurantId || "rest-01",
      code: p.code,
      titleAr: p.title || p.titleAr || "عرض ترويجي",
      descriptionAr: p.description || p.descriptionAr,
      discountType: (p.discountType === "FIXED" ? "FIXED_AMOUNT" : p.discountType) as any,
      discountValue: p.discountValue,
      minOrderTotal: p.minOrderAmount || p.minOrderTotal || 0,
      maxDiscount: p.maxDiscountAmount || p.maxDiscount,
      usageLimit: p.usageLimit,
      usedCount: p.timesUsed ?? p.usedCount ?? 0,
      startDate: p.startDate || p.createdAt || new Date().toISOString(),
      endDate: p.endDate || new Date(Date.now() + 30 * 86400000).toISOString(),
      isActive: p.isActive ?? true,
      createdAt: p.createdAt || new Date().toISOString(),
    };
  }

  getMissingContracts(): PromotionEndpointContract[] {
    return [
      {
        method: "GET",
        endpoint: "/api/v1/admin/promotions",
        descriptionAr: "استرجاع قائمة العروض الترويجية وكوبونات الخصم النشطة والمنتهية",
        expectedResponse: "Array<Promotion>",
      },
      {
        method: "POST",
        endpoint: "/api/v1/admin/promotions",
        descriptionAr: "إنشاء كوبون خصم جديد بنسبة مئوية أو قيمة ثابتة مع تاريخ الصلاحية",
        expectedPayload: "CreatePromotionRequest",
        expectedResponse: "Promotion",
      },
      {
        method: "PATCH",
        endpoint: "/api/v1/admin/promotions/:id",
        descriptionAr: "تفعيل أو إيقاف العرض الترويجي",
      },
      {
        method: "DELETE",
        endpoint: "/api/v1/admin/promotions/:id",
        descriptionAr: "حذف الكوبون أو العرض نهائياً",
      },
    ];
  }

  async listPromotions(): Promise<Promotion[]> {
    const list = await apiClient.get<any[]>("/api/v1/admin/promotions");
    return (list || []).map((p) => this.mapBackendPromotion(p));
  }

  async createPromotion(req: CreatePromotionRequest): Promise<Promotion> {
    const backendPayload = {
      code: req.code,
      title: req.titleAr,
      discountType: req.discountType === "FIXED_AMOUNT" ? "FIXED" : req.discountType,
      discountValue: req.discountValue,
      minOrderAmount: req.minOrderTotal || 0,
      maxDiscountAmount: req.maxDiscount,
      startDate: req.startDate,
      endDate: req.endDate,
      isActive: req.isActive,
      usageLimit: req.usageLimit,
    };
    const live = await apiClient.post<any>("/api/v1/admin/promotions", backendPayload);
    return this.mapBackendPromotion(live);
  }

  async togglePromotion(id: string, isActive: boolean): Promise<Promotion> {
    const live = await apiClient.patch<any>(`/api/v1/admin/promotions/${id}`, { isActive });
    return this.mapBackendPromotion(live);
  }

  async deletePromotion(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/admin/promotions/${id}`);
  }
}

export const promotionsService = new PromotionsService();
