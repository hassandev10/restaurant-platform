import { Restaurant, Branch } from "@/types/restaurant";
import { RestaurantTable } from "@/types/table";
import { restaurantRpc } from "@/lib/rpc-client";

export interface IRestaurantRepository {
  getRestaurantBySlug(slug: string): Promise<Restaurant | null>;
  getTableByToken(restaurantId: string, token: string): Promise<RestaurantTable | null>;
  getBranchById(branchId: string): Promise<Branch | null>;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export class ApiRestaurantRepository implements IRestaurantRepository {
  async getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
    try {
      const res = await restaurantRpc.getRestaurant({ slug });
      if (!res.restaurant) return null;
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
      };
    } catch (err) {
      console.error(`ApiRestaurantRepository.getRestaurantBySlug RPC failed for ${slug}:`, err);
      if (slug === "demo-restaurant") {
        return {
          id: "rest-01",
          name: "مطعم الزيتونة",
          slug: "demo-restaurant",
          description: "أكل طازة وطعم يلمّ العيلة • أشهى المشويات المصرية والمأكولات الشرقية الأصيلة",
          logoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=250&q=80",
          currency: "EGP",
          isOpen: true,
          estimatedPreparationMinutes: 25,
        };
      }
      return null;
    }
  }

  async getTableByToken(restaurantId: string, token: string): Promise<RestaurantTable | null> {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/restaurants/${encodeURIComponent(restaurantId)}/tables/${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`ApiRestaurantRepository.getTableByToken failed for ${token}:`, err);
      if (token === "demo-table-token") {
        return {
          id: "table-04",
          restaurantId: "rest-01",
          branchId: "branch-01",
          tableNumber: 4,
          name: "طاولة 4",
          capacity: 4,
          section: "MAIN_HALL",
          sectionNameAr: "الصالة الرئيسية",
          token: "demo-table-token",
          status: "AVAILABLE",
        };
      }
      return null;
    }
  }

  async getBranchById(branchId: string): Promise<Branch | null> {
    try {
      const res = await restaurantRpc.getBranch({ branchId });
      if (!res.branch) return null;
      return {
        id: res.branch.id,
        restaurantId: res.branch.restaurantId,
        name: res.branch.name,
      };
    } catch (err) {
      console.error(`ApiRestaurantRepository.getBranchById RPC failed for ${branchId}:`, err);
      return {
        id: branchId,
        restaurantId: "rest-01",
        name: "الفرع الرئيسي",
      };
    }
  }
}

export const restaurantRepository: IRestaurantRepository = new ApiRestaurantRepository();
