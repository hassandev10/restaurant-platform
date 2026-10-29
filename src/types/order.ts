export type OrderStatus =
  | "NEW"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "CANCELLED";

export type PaymentStatus =
  | "PENDING_CASHIER"
  | "PAID"
  | "CANCELLED";

export interface SelectedOptionSnapshot {
  groupId: string;
  groupNameAr: string;
  optionId: string;
  optionNameAr: string;
  priceDelta: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  selectedOptions?: SelectedOptionSnapshot[];
  notes?: string;
  lineTotal: number;
}

export interface OrderEvent {
  id: string;
  timestamp: string; // ISO 8601
  status: OrderStatus;
  actor: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  restaurantId: string;
  branchId: string;
  tableId: string;
  tableName: string;
  tableNameSnapshot?: string;
  sessionId?: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  total: number;
  paymentStatus: PaymentStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  events?: OrderEvent[];
}
