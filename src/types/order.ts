import { SelectedOptionSnapshot } from "./cart";

export type OrderStatus =
  | "NEW"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "CANCELLED";

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
  orderType?: "DINE_IN" | "TAKEAWAY";
  restaurantId: string;
  branchId: string;
  tableId: string;
  tableName: string; // Table name (e.g. "طاولة 4")
  tableNameSnapshot?: string; // For backward compatibility with existing customer code
  sessionId?: string; // Real backend dining session reference (UUID)
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  total: number;
  paymentStatus: PaymentStatus;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
  events: OrderEvent[];
}

export interface TableSessionSummaryInfo {
  sessionId: string;
  tableId: string;
  tableName: string;
  openedAt?: string;
  status: "OPEN" | "CLOSED";
  orders: Order[];
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  hasActiveOrders: boolean;
}

export interface OrderPaginationParams {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
  tableId?: string;
  sessionId?: string;
  from?: string;
  to?: string;
}

export interface PaginatedOrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
