import { Restaurant, Branch, TableValidationResult } from "@/types/restaurant";
import { RestaurantTable, TableSection, TableStatus } from "@/types/table";
import { restaurantRpc, tableRpc } from "@/lib/rpc-client";

export interface IRestaurantRepository {
  getRestaurantBySlug(slug: string): Promise<Restaurant | null>;
  getTableByToken(restaurantSlug: string, token: string): Promise<RestaurantTable | null>;
  getBranchById(branchId: string): Promise<Branch | null>;
  validateTable(restaurantSlug: string, tableInput: string): Promise<TableValidationResult>;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

/**
 * Normalizes Eastern Arabic-Indic numerals (٠-٩) and Persian numerals (۰-۹) to standard ASCII digits (0-9).
 */
export function normalizeArabicDigits(str: string): string {
  return str
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
}

interface BackendTableResponse {
  id: string;
  restaurantId?: string;
  branchId?: string;
  tableNumber?: string | number;
  name?: string;
  displayName?: string;
  capacity?: number;
  sectionId?: string;
  sectionName?: string;
  token?: string;
  status: TableStatus;
  createdAt?: string;
  updatedAt?: string;
}

function mapBackendToTable(data: BackendTableResponse, fallbackToken: string): RestaurantTable {
  const rawNumStr = String(data.tableNumber || data.name || "").replace(/\D/g, "");
  const num = parseInt(rawNumStr, 10) || 1;

  let section: TableSection = "MAIN_HALL";
  const secName = data.sectionName || data.name || "";
  if (secName.includes("تراس") || secName.includes("ترّاس") || data.sectionId === "sec-terrace") {
    section = "TERRACE";
  } else if (secName.includes("VIP") || data.sectionId === "sec-vip") {
    section = "VIP";
  } else if (secName.includes("عائلات")) {
    section = "FAMILY";
  }

  return {
    id: data.id,
    restaurantId: data.restaurantId || "rest-01",
    branchId: data.branchId || "branch-01",
    tableNumber: num,
    name: data.displayName || data.name || `طاولة ${num}`,
    capacity: data.capacity || 4,
    section,
    sectionNameAr:
      data.sectionName ||
      (section === "TERRACE"
        ? "التراس الخارجي"
        : section === "VIP"
        ? "جناح VIP"
        : "الصالة الرئيسية"),
    token: data.token || fallbackToken,
    status: data.status || "AVAILABLE",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

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
      // Fallback
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

  async getTableByToken(restaurantSlug: string, token: string): Promise<RestaurantTable | null> {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/restaurants/${encodeURIComponent(restaurantSlug)}/tables/${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data: BackendTableResponse = await res.json();
      return mapBackendToTable(data, token);
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

  async validateTable(restaurantSlug: string, tableInput: string): Promise<TableValidationResult> {
    const raw = (tableInput || "").trim();
    if (!raw) {
      return {
        valid: false,
        code: "EMPTY_INPUT",
        error: "يرجى إدخال رقم الطاولة",
      };
    }

    const normalized = normalizeArabicDigits(raw);

    try {
      const res = await tableRpc.validateTableNumber({
        restaurantSlug,
        tableInput: normalized,
      });

      if (!res.valid || !res.table) {
        return {
          valid: false,
          code: (res.code as any) || "NOT_FOUND",
          error: res.errorMessage || "رقم الطاولة غير موجود في هذا المطعم. يرجى التأكد من الرقم والمحاولة مرة أخرى.",
        };
      }

      const t = res.table;
      const rawNumStr = String(t.tableNumber || t.displayName || "").replace(/\D/g, "");
      const num = parseInt(rawNumStr, 10) || 1;

      return {
        valid: true,
        token: res.token,
        tableContextToken: res.tableContextToken,
        table: {
          id: t.id || `table-${num}`,
          restaurantId: t.restaurantId || "rest-01",
          branchId: t.branchId || "branch-01",
          tableNumber: num,
          name: t.displayName || `طاولة ${num}`,
          capacity: t.capacity || 4,
          section: "MAIN_HALL",
          sectionNameAr: t.sectionName || "الصالة الرئيسية",
          token: res.token,
          status: "AVAILABLE",
        },
      };
    } catch (err: any) {
      console.error(`ApiRestaurantRepository.validateTable RPC error for ${tableInput}:`, err);
      // Fallback for demo table token
      if (normalized === "4" || normalized === "demo-table-token") {
        return {
          valid: true,
          token: "tbl-04",
          table: {
            id: "table-04",
            restaurantId: "rest-01",
            branchId: "branch-01",
            tableNumber: 4,
            name: "طاولة 4",
            capacity: 4,
            section: "MAIN_HALL",
            sectionNameAr: "الصالة الرئيسية",
            token: "tbl-04",
            status: "AVAILABLE",
          },
        };
      }
      return {
        valid: false,
        code: "SERVER_ERROR",
        error: err?.message || "حدث خطأ أثناء التحقق من رقم الطاولة",
      };
    }
  }
}

export const restaurantRepository: IRestaurantRepository = new ApiRestaurantRepository();
