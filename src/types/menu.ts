export type OptionSelectionType = "SINGLE" | "MULTIPLE";

export interface ProductOption {
  id: string;
  nameAr: string;
  priceDelta: number;
  isAvailable: boolean;
}

export interface ProductOptionGroup {
  id: string;
  nameAr: string;
  selectionType: OptionSelectionType;
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
  imageUrl: string;
  isAvailable: boolean;
  isFeatured?: boolean;
  badge?: "الأكثر طلبًا" | "جديد" | "توصية الشيف" | "نباتي";
  options: ProductOptionGroup[];
}

export interface MenuCategory {
  id: string;
  restaurantId: string;
  nameAr: string;
  nameEn?: string;
  displayOrder: number;
  isActive: boolean;
  iconName?: string;
}
