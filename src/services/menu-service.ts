import { apiClient } from "@/lib/api-client";
import { CONFIG } from "@/lib/config";
import {
  CreateCategoryRequest,
  CreateProductRequest,
  MenuCategory,
  MenuResponse,
  Product,
  UpdateProductRequest,
} from "@/types/menu";

export interface IMenuService {
  getMenu(slug?: string): Promise<MenuResponse>;
  getCategories(slug?: string): Promise<MenuCategory[]>;
  getProducts(slug?: string, categoryId?: string, search?: string): Promise<Product[]>;
  getProduct(productId: string): Promise<Product>;

  // Mutation operations (Typed contracts for Go backend)
  createProduct(req: CreateProductRequest): Promise<{ success: boolean; product: Product; isContractLive: boolean }>;
  updateProduct(productId: string, req: UpdateProductRequest): Promise<{ success: boolean; product: Product; isContractLive: boolean }>;
  deleteProduct(productId: string): Promise<{ success: boolean; isContractLive: boolean }>;
  toggleAvailability(productId: string, isAvailable: boolean): Promise<{ success: boolean; isContractLive: boolean }>;
  createCategory(req: CreateCategoryRequest): Promise<{ success: boolean; category: MenuCategory; isContractLive: boolean }>;
}

export class MenuService implements IMenuService {
  async getMenu(slug: string = CONFIG.defaultRestaurantSlug): Promise<MenuResponse> {
    const raw = await apiClient.get<MenuResponse>(`/api/v1/restaurants/${slug}/menu`, undefined, { skipAuth: true });
    
    let categories = raw.categories || [];
    let products = raw.products || [];

    // If selected slug has null/empty categories and isn't demo-restaurant, fallback to demo-restaurant
    if (categories.length === 0 && slug !== "demo-restaurant") {
      try {
        const demo = await apiClient.get<MenuResponse>("/api/v1/restaurants/demo-restaurant/menu", undefined, { skipAuth: true });
        if (demo.categories && demo.categories.length > 0) {
          categories = demo.categories;
          products = demo.products || [];
        }
      } catch {
        // ignore
      }
    }

    return {
      restaurant: raw.restaurant,
      categories,
      products,
    };
  }

  async getCategories(slug: string = CONFIG.defaultRestaurantSlug): Promise<MenuCategory[]> {
    const raw = await apiClient.get<MenuCategory[]>(`/api/v1/restaurants/${slug}/categories`, undefined, { skipAuth: true });
    if ((!raw || raw.length === 0) && slug !== "demo-restaurant") {
      try {
        const demo = await apiClient.get<MenuCategory[]>("/api/v1/restaurants/demo-restaurant/categories", undefined, { skipAuth: true });
        if (demo && demo.length > 0) return demo;
      } catch {
        // ignore
      }
    }
    return raw || [];
  }

  async getProducts(slug: string = CONFIG.defaultRestaurantSlug, categoryId?: string, search?: string): Promise<Product[]> {
    const raw = await apiClient.get<Product[]>(`/api/v1/restaurants/${slug}/products`, { categoryId, query: search }, { skipAuth: true });
    if ((!raw || raw.length === 0) && slug !== "demo-restaurant") {
      try {
        const demo = await apiClient.get<Product[]>("/api/v1/restaurants/demo-restaurant/products", { categoryId, query: search }, { skipAuth: true });
        if (demo && demo.length > 0) return demo;
      } catch {
        // ignore
      }
    }
    return raw || [];
  }

  async getProduct(productId: string): Promise<Product> {
    return await apiClient.get<Product>(`/api/v1/products/${productId}`, undefined, { skipAuth: true });
  }

  /**
   * Admin Menu Mutations (Direct Go Backend Contract)
   */
  async createProduct(req: CreateProductRequest): Promise<{ success: boolean; product: Product; isContractLive: boolean }> {
    const live = await apiClient.post<Product>("/api/v1/admin/products", req);
    return { success: true, product: live, isContractLive: true };
  }

  async updateProduct(productId: string, req: UpdateProductRequest): Promise<{ success: boolean; product: Product; isContractLive: boolean }> {
    const live = await apiClient.patch<Product>(`/api/v1/admin/products/${productId}`, req);
    return { success: true, product: live, isContractLive: true };
  }

  async deleteProduct(productId: string): Promise<{ success: boolean; isContractLive: boolean }> {
    await apiClient.delete(`/api/v1/admin/products/${productId}`);
    return { success: true, isContractLive: true };
  }

  async toggleAvailability(productId: string, isAvailable: boolean): Promise<{ success: boolean; isContractLive: boolean }> {
    await apiClient.patch(`/api/v1/admin/products/${productId}/availability`, { isAvailable });
    return { success: true, isContractLive: true };
  }

  async createCategory(req: CreateCategoryRequest): Promise<{ success: boolean; category: MenuCategory; isContractLive: boolean }> {
    const live = await apiClient.post<MenuCategory>("/api/v1/admin/categories", req);
    return { success: true, category: live, isContractLive: true };
  }
}

export const menuService = new MenuService();
