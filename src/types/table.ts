export type TableStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "RESERVED"
  | "CLEANING"
  | "OUT_OF_SERVICE";

export type SessionStatus = "OPEN" | "CLOSED";

export interface TableSessionSummary {
  id: string;
  openedBy?: string;
  openedByName?: string;
  openedAt: string; // RFC3339
  status: SessionStatus;
  durationMinutes: number;
  notes?: string;
}

export interface ActiveOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  itemsCount: number;
  createdAt: string; // RFC3339
}

export interface RestaurantTable {
  id: string;
  restaurantId: string;
  branchId?: string;
  tableNumber: string;
  displayName: string;
  name?: string;
  capacity: number;
  sectionId?: string;
  sectionName?: string;
  token: string;
  status: TableStatus;
  isActive: boolean;
  currentSession?: TableSessionSummary;
  activeOrder?: ActiveOrderSummary;
  createdAt: string;
  updatedAt: string;
}

export interface TableSection {
  id: string;
  restaurantId: string;
  branchId?: string;
  name: string;
  displayOrder: number;
  createdAt: string;
}

export interface CreateTableRequest {
  tableNumber: string;
  displayName?: string;
  capacity: number;
  sectionId?: string;
  branchId?: string;
}

export interface UpdateTableRequest {
  displayName?: string;
  capacity?: number;
  sectionId?: string;
  status?: TableStatus;
}

export interface TableFilterQuery {
  status?: string;
  sectionId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedTablesResponse {
  tables: RestaurantTable[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TableQRResponse {
  tableId: string;
  tableNumber: string;
  displayName: string;
  sectionName: string;
  token: string;
  customerUrl: string;
  shortCustomerUrl: string;
  restaurantName: string;
  restaurantSlug: string;
  branchName: string;
  generatedAt: string;
}
