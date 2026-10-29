import { restaurantRpc } from "@/lib/rpc-client";
import { CONFIG } from "@/lib/config";
import { Restaurant, RestaurantSettingsUpdateRequest } from "@/types/restaurant";

export interface IRestaurantService {
  getRestaurant(slug?: string): Promise<Restaurant>;
  updateSettings(slug: string, req: RestaurantSettingsUpdateRequest): Promise<{
    success: boolean;
    data: Restaurant;
    message: string;
    isBackendEndpointAvailable: boolean;
  }>;
}

export class RestaurantService implements IRestaurantService {
  async getRestaurant(slug: string = CONFIG.defaultRestaurantSlug): Promise<Restaurant> {
    const res = await restaurantRpc.getRestaurant({ slug });
    if (!res.restaurant) throw new Error("المطعم غير موجود");
    const r = res.restaurant;
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      logoUrl: r.logoUrl,
      currency: r.currency,
      isOpen: r.isOpen,
      estimatedPreparationMinutes: r.estimatedPreparationMinutes,
      phone: r.phone,
      address: r.address,
      openingHours: r.openingHours,
      taxRate: r.taxRate,
      serviceFeeRate: r.serviceFeeRate,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async updateSettings(
    slug: string = CONFIG.defaultRestaurantSlug,
    req: RestaurantSettingsUpdateRequest
  ): Promise<{
    success: boolean;
    data: Restaurant;
    message: string;
    isBackendEndpointAvailable: boolean;
  }> {
    try {
      const res = await restaurantRpc.updateRestaurantSettings({
        name: req.name,
        description: req.description,
        logoUrl: req.logoUrl,
        currency: req.currency,
        isOpen: req.isOpen,
        estimatedPreparationMinutes: req.estimatedPreparationMinutes,
        phone: req.phone,
        address: req.address,
        openingHours: req.openingHours,
        taxRate: req.taxRate,
        serviceFeeRate: req.serviceFeeRate,
      });
      if (!res.restaurant) throw new Error("لم يتم إرجاع بيانات المطعم المحدثة");
      const r = res.restaurant;
      return {
        success: true,
        data: {
          id: r.id,
          name: r.name,
          slug: r.slug,
          description: r.description,
          logoUrl: r.logoUrl,
          currency: r.currency,
          isOpen: r.isOpen,
          estimatedPreparationMinutes: r.estimatedPreparationMinutes,
          phone: r.phone,
          address: r.address,
          openingHours: r.openingHours,
          taxRate: r.taxRate,
          serviceFeeRate: r.serviceFeeRate,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        },
        message: "تم حفظ إعدادات المطعم بنجاح في قاعدة البيانات عبر السيرفر",
        isBackendEndpointAvailable: true,
      };
    } catch (err: any) {
      const current = await this.getRestaurant(slug).catch(() => ({
        id: "rest-01",
        name: "مطعم الزيتونة",
        slug: "demo-restaurant",
        description: "",
        logoUrl: "",
        currency: "EGP",
        isOpen: true,
        estimatedPreparationMinutes: 25,
      }));
      return {
        success: false,
        data: current,
        message: err?.message || "فشل تحديث إعدادات المطعم عبر الخادم",
        isBackendEndpointAvailable: false,
      };
    }
  }
}

export const restaurantService = new RestaurantService();
