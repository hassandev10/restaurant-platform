import { SelectedOptionSnapshot } from "./cart";

export type OrderStatus =
  | "NEW"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "CANCELLED";

export type OrderType = "DINE_IN" | "TAKEAWAY";

export type PaymentStatus = "PENDING_CASHIER" | "PAID" | "CANCELLED";

export interface OrderEvent {
  id: string;
  timestamp: string; // ISO 8601 string
  status: OrderStatus;
  actor: string; // e.g. "العميل", "الكابتن أحمد (مشرف الصالة)", "المطبخ", "النظام"
  note?: string; // Optional reason or context
}

export interface OrderItem {
  id: string;
  productId: string;
  productNameSnapshot: string;
  unitPriceSnapshot: number; // basePrice + sum(selected options priceDelta)
  quantity: number;
  selectedOptions: SelectedOptionSnapshot[];
  notes?: string;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderType?: OrderType;
  restaurantId: string;
  branchId: string;
  tableId: string;
  tableName: string; // Table name (e.g. "طاولة 4")
  tableNameSnapshot?: string; // For backward compatibility with existing customer code
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  total: number;
  paymentStatus: PaymentStatus;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
  events: OrderEvent[];
}
