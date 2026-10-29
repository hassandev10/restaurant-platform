import { MenuCategory, Product } from "@/types/menu";

export interface IMenuRepository {
  getCategories(restaurantId: string): Promise<MenuCategory[]>;
  getProducts(restaurantId: string, categoryId?: string, query?: string): Promise<Product[]>;
  getProductById(productId: string): Promise<Product | null>;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export class ApiMenuRepository implements IMenuRepository {
  async getCategories(restaurantId: string): Promise<MenuCategory[]> {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/restaurants/${encodeURIComponent(restaurantId)}/categories`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("ApiMenuRepository.getCategories failed:", err);
      return [];
    }
  }

  async getProducts(
    restaurantId: string,
    categoryId?: string,
    query?: string
  ): Promise<Product[]> {
    try {
      const params = new URLSearchParams();
      if (categoryId && categoryId !== "all") params.append("categoryId", categoryId);
      if (query && query.trim() !== "") params.append("query", query.trim());

      const res = await fetch(
        `${API_BASE_URL}/api/v1/restaurants/${encodeURIComponent(restaurantId)}/products?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("ApiMenuRepository.getProducts failed:", err);
      return [];
    }
  }

  async getProductById(productId: string): Promise<Product | null> {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/products/${encodeURIComponent(productId)}`,
        { cache: "no-store" }
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`ApiMenuRepository.getProductById failed for ${productId}:`, err);
      return null;
    }
  }
}

export const menuRepository: IMenuRepository = new ApiMenuRepository();
