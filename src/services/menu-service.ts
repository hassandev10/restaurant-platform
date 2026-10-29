import { menuRpc } from "@/lib/rpc-client";
import { CONFIG } from "@/lib/config";
import {
  CreateCategoryRequest,
  CreateProductRequest,
  MenuCategory,
  MenuResponse,
  Product,
  UpdateProductRequest,
} from "@/types/menu";

function mapProtoCategory(c: any): MenuCategory {
  if (!c) return {} as MenuCategory;
  return {
    id: c.id,
    restaurantId: c.restaurantId,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    displayOrder: c.displayOrder,
    isActive: c.isActive,
    iconName: c.iconName,
  };
}

function mapProtoProduct(p: any): Product {
  if (!p) return {} as Product;
  return {
    id: p.id,
    restaurantId: p.restaurantId,
    categoryId: p.categoryId,
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    description: p.description,
    price: p.price,
    discountPrice: p.discountPrice,
    imageUrl: p.imageUrl,
    isAvailable: p.isAvailable,
    isFeatured: p.isFeatured,
    badge: p.badge,
    options: (p.options || []).map((og: any) => ({
      id: og.id,
      nameAr: og.nameAr,
      selectionType: og.maxSelection === 1 ? ("SINGLE" as const) : ("MULTIPLE" as const),
      isRequired: og.isRequired,
      minSelections: og.minSelection,
      maxSelections: og.maxSelection,
      options: (og.options || []).map((opt: any) => ({
        id: opt.id,
        nameAr: opt.nameAr,
        priceDelta: opt.priceModifier,
        isAvailable: opt.isAvailable,
      })),
    })),
  };
}

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
    const res = await menuRpc.getMenu({ restaurantSlug: slug });
    
    let categories = (res.categories || []).map(mapProtoCategory);
    let products = (res.products || []).map(mapProtoProduct);

    // If selected slug has null/empty categories and isn't demo-restaurant, fallback to demo-restaurant
    if (categories.length === 0 && slug !== "demo-restaurant") {
      try {
        const demo = await menuRpc.getMenu({ restaurantSlug: "demo-restaurant" });
        if (demo.categories && demo.categories.length > 0) {
          categories = demo.categories.map(mapProtoCategory);
          products = (demo.products || []).map(mapProtoProduct);
        }
      } catch {
        // ignore
      }
    }

    return {
      restaurant: res.restaurant ? {
        id: res.restaurant.id,
        nameAr: res.restaurant.nameAr,
        nameEn: res.restaurant.nameEn,
        slug: res.restaurant.slug,
        logoUrl: res.restaurant.logoUrl,
        heroImageUrl: res.restaurant.heroImageUrl,
        primaryColor: res.restaurant.primaryColor,
        secondaryColor: res.restaurant.secondaryColor,
        phone: res.restaurant.phone,
        currency: res.restaurant.currency || "EGP",
        isActive: res.restaurant.isActive,
        allowOrdering: res.restaurant.allowOrdering,
      } : ({} as any),
      categories,
      products,
    };
  }

  async getCategories(slug: string = CONFIG.defaultRestaurantSlug): Promise<MenuCategory[]> {
    const res = await menuRpc.listCategories({ restaurantSlug: slug });
    let categories = (res.categories || []).map(mapProtoCategory);
    if (categories.length === 0 && slug !== "demo-restaurant") {
      try {
        const demo = await menuRpc.listCategories({ restaurantSlug: "demo-restaurant" });
        if (demo.categories && demo.categories.length > 0) {
          categories = demo.categories.map(mapProtoCategory);
        }
      } catch {
        // ignore
      }
    }
    return categories;
  }

  async getProducts(slug: string = CONFIG.defaultRestaurantSlug, categoryId?: string, search?: string): Promise<Product[]> {
    const res = await menuRpc.listProducts({
      restaurantSlug: slug,
      categoryId: categoryId && categoryId !== "all" ? categoryId : "",
      query: search ? search.trim() : "",
    });
    let products = (res.products || []).map(mapProtoProduct);
    if (products.length === 0 && slug !== "demo-restaurant") {
      try {
        const demo = await menuRpc.listProducts({
          restaurantSlug: "demo-restaurant",
          categoryId: categoryId && categoryId !== "all" ? categoryId : "",
          query: search ? search.trim() : "",
        });
        if (demo.products && demo.products.length > 0) {
          products = demo.products.map(mapProtoProduct);
        }
      } catch {
        // ignore
      }
    }
    return products;
  }

  async getProduct(productId: string): Promise<Product> {
    const res = await menuRpc.getProduct({ productId });
    return mapProtoProduct(res.product);
  }

  /**
   * Admin Menu Mutations (Direct Go Backend ConnectRPC)
   */
  async createProduct(req: CreateProductRequest): Promise<{ success: boolean; product: Product; isContractLive: boolean }> {
    const res = await menuRpc.createProduct({
      categoryId: req.categoryId,
      nameAr: req.nameAr,
      nameEn: req.nameEn,
      description: req.description,
      price: req.price,
      discountPrice: req.discountPrice,
      imageUrl: req.imageUrl,
      isAvailable: req.isAvailable,
      isFeatured: req.isFeatured,
      badge: req.badge,
      options: (req.options || []).map((g) => ({
        nameAr: g.nameAr,
        minSelection: g.minSelections || 0,
        maxSelection: g.maxSelections || 1,
        isRequired: g.isRequired,
        options: (g.options || []).map((o) => ({
          nameAr: o.nameAr,
          priceModifier: o.priceDelta,
          isAvailable: o.isAvailable,
        })),
      })),
    });
    return { success: true, product: mapProtoProduct(res.product), isContractLive: true };
  }

  async updateProduct(productId: string, req: UpdateProductRequest): Promise<{ success: boolean; product: Product; isContractLive: boolean }> {
    const res = await menuRpc.updateProduct({
      id: productId,
      categoryId: req.categoryId,
      nameAr: req.nameAr,
      nameEn: req.nameEn,
      description: req.description,
      price: req.price,
      discountPrice: req.discountPrice,
      imageUrl: req.imageUrl,
      isAvailable: req.isAvailable,
      isFeatured: req.isFeatured,
      badge: req.badge,
      options: req.options
        ? req.options.map((g) => ({
            nameAr: g.nameAr,
            minSelection: g.minSelections || 0,
            maxSelection: g.maxSelections || 1,
            isRequired: g.isRequired,
            options: (g.options || []).map((o) => ({
              nameAr: o.nameAr,
              priceModifier: o.priceDelta,
              isAvailable: o.isAvailable,
            })),
          }))
        : [],
    });
    return { success: true, product: mapProtoProduct(res.product), isContractLive: true };
  }

  async deleteProduct(productId: string): Promise<{ success: boolean; isContractLive: boolean }> {
    const res = await menuRpc.deleteProduct({ id: productId });
    return { success: res.success, isContractLive: true };
  }

  async toggleAvailability(productId: string, isAvailable: boolean): Promise<{ success: boolean; isContractLive: boolean }> {
    const res = await menuRpc.toggleProductAvailability({ productId, isAvailable });
    return { success: res.success, isContractLive: true };
  }

  async createCategory(req: CreateCategoryRequest): Promise<{ success: boolean; category: MenuCategory; isContractLive: boolean }> {
    const res = await menuRpc.createCategory({
      nameAr: req.nameAr,
      nameEn: req.nameEn,
      displayOrder: req.displayOrder,
      isActive: req.isActive,
      iconName: req.iconName,
    });
    return { success: true, category: mapProtoCategory(res.category), isContractLive: true };
  }
}

export const menuService = new MenuService();
