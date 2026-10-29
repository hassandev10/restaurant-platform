import { MenuCategory, Product } from "@/types/menu";
import { menuRpc } from "@/lib/rpc-client";

export interface IMenuRepository {
  getCategories(restaurantId: string): Promise<MenuCategory[]>;
  getProducts(restaurantId: string, categoryId?: string, query?: string): Promise<Product[]>;
  getProductById(productId: string): Promise<Product | null>;
}

export class ApiMenuRepository implements IMenuRepository {
  async getCategories(restaurantId: string): Promise<MenuCategory[]> {
    try {
      const res = await menuRpc.listCategories({ restaurantSlug: restaurantId });
      return (res.categories || []).map((c) => ({
        id: c.id,
        restaurantId: c.restaurantId,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        displayOrder: c.displayOrder,
        isActive: c.isActive,
        iconName: c.iconName,
      }));
    } catch (err) {
      console.error("ApiMenuRepository.getCategories RPC failed:", err);
      return [];
    }
  }

  async getProducts(
    restaurantId: string,
    categoryId?: string,
    query?: string
  ): Promise<Product[]> {
    try {
      const res = await menuRpc.listProducts({
        restaurantSlug: restaurantId,
        categoryId: categoryId && categoryId !== "all" ? categoryId : "",
        query: query ? query.trim() : "",
      });
      return (res.products || []).map((p) => ({
        id: p.id,
        restaurantId: p.restaurantId,
        categoryId: p.categoryId,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        description: p.description,
        price: p.price,
        imageUrl: p.imageUrl,
        isAvailable: p.isAvailable,
        isFeatured: p.isFeatured,
        badge: p.badge as Product["badge"],
        options: (p.options || []).map((og) => ({
          id: og.id,
          nameAr: og.nameAr,
          selectionType: "MULTIPLE" as const,
          isRequired: og.isRequired,
          minSelections: og.minSelection,
          maxSelections: og.maxSelection,
          options: (og.options || []).map((opt) => ({
            id: opt.id,
            nameAr: opt.nameAr,
            priceDelta: opt.priceModifier,
            isAvailable: opt.isAvailable,
          })),
        })),
      }));
    } catch (err) {
      console.error("ApiMenuRepository.getProducts RPC failed:", err);
      return [];
    }
  }

  async getProductById(productId: string): Promise<Product | null> {
    try {
      const res = await menuRpc.getProduct({ productId });
      if (!res.product) return null;
      const p = res.product;
      return {
        id: p.id,
        restaurantId: p.restaurantId,
        categoryId: p.categoryId,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        description: p.description,
        price: p.price,
        imageUrl: p.imageUrl,
        isAvailable: p.isAvailable,
        isFeatured: p.isFeatured,
        badge: p.badge as Product["badge"],
        options: (p.options || []).map((og) => ({
          id: og.id,
          nameAr: og.nameAr,
          selectionType: "MULTIPLE" as const,
          isRequired: og.isRequired,
          minSelections: og.minSelection,
          maxSelections: og.maxSelection,
          options: (og.options || []).map((opt) => ({
            id: opt.id,
            nameAr: opt.nameAr,
            priceDelta: opt.priceModifier,
            isAvailable: opt.isAvailable,
          })),
        })),
      };
    } catch (err) {
      console.error(`ApiMenuRepository.getProductById RPC failed for ${productId}:`, err);
      return null;
    }
  }
}

export const menuRepository: IMenuRepository = new ApiMenuRepository();
