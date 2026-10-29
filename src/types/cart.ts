export interface SelectedOptionSnapshot {
  groupId: string;
  groupNameAr: string;
  optionId: string;
  optionNameAr: string;
  priceDelta: number;
}

export interface CartItem {
  id: string; // unique item id in cart
  productId: string;
  productNameSnapshot: string;
  imageUrlSnapshot: string;
  basePrice: number;
  quantity: number;
  selectedOptions: SelectedOptionSnapshot[];
  notes?: string;
  lineTotal: number;
}

export interface CartState {
  items: CartItem[];
  subtotal: number;
  total: number;
  totalItemsCount: number;
}
