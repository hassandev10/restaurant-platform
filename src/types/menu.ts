import { Restaurant } from "./restaurant";

export interface MenuCategory {
  id: string;
  restaurantId: string;
  nameAr: string;
  nameEn?: string;
  displayOrder: number;
  isActive: boolean;
  iconName?: string;
}

export interface ProductOption {
  id: string;
  nameAr: string;
  priceDelta: number;
  isAvailable: boolean;
}

export interface ProductOptionGroup {
  id: string;
  nameAr: string;
  selectionType: "SINGLE" | "MULTIPLE";
  isRequired: boolean;
  minSelections?: number;
  maxSelections?: number;
  options: ProductOption[];
}

export interface Product {
  id: string;
  restaurantId: string;
  categoryId: string;
  nameAr: string;
  nameEn?: string;
  description: string;
  price: number;
  discountPrice?: number;
  imageUrl: string;
  isAvailable: boolean;
  isFeatured: boolean;
  badge?: string;
  options?: ProductOptionGroup[];
}

export interface MenuResponse {
  restaurant: Restaurant;
  categories: MenuCategory[];
  products: Product[];
}

export interface CreateProductRequest {
  categoryId: string;
  nameAr: string;
  nameEn?: string;
  description: string;
  price: number;
  discountPrice?: number;
  imageUrl?: string;
  isAvailable: boolean;
  isFeatured?: boolean;
  badge?: string;
  options?: ProductOptionGroup[];
}

export interface UpdateProductRequest {
  categoryId?: string;
  nameAr?: string;
  nameEn?: string;
  description?: string;
  price?: number;
  discountPrice?: number;
  imageUrl?: string;
  isAvailable?: boolean;
  isFeatured?: boolean;
  badge?: string;
  options?: ProductOptionGroup[];
}

export interface CreateCategoryRequest {
  nameAr: string;
  nameEn?: string;
  displayOrder?: number;
  isActive?: boolean;
  iconName?: string;
}
