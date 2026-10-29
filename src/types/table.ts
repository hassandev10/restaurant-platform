import { OrderStatus } from "./order";

export type TableStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "RESERVED"
  | "CLEANING"
  | "OUT_OF_SERVICE"
  // Backwards compatibility alias for older references
  | "ACTIVE"
  | "INACTIVE";

export type TableSection = "MAIN_HALL" | "TERRACE" | "VIP" | "FAMILY";

export interface TableReservation {
  id: string;
  guestName: string;
  guestPhone: string;
  guestCount: number;
  reservedTime: string; // ISO string
  notes?: string;
  createdAt: string;
}

export interface RestaurantTable {
  id: string;
  tableNumber: number;
  restaurantId: string;
  branchId: string;
  name: string;
  token: string;
  status: TableStatus;
  capacity: number; // e.g. 2, 4, 6, 8 seats
  section: TableSection;
  sectionNameAr: string;
  floor?: string;

  // Active session and order linkage
  currentSession?: {
    id: string;
    openedAt: string;
    status: string;
    durationMinutes?: number;
    openedByName?: string;
    notes?: string;
  };
  currentOrderId?: string;
  currentOrderNumber?: string;
  currentOrderTotal?: number;
  currentOrderStatus?: OrderStatus;
  sessionStartedAt?: string; // ISO string
  guestCount?: number;

  // Reservation details if reserved
  currentReservation?: TableReservation;

  notes?: string;
  updatedAt?: string;
}

export interface TableStats {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  cleaning: number;
  outOfService: number;
  attentionRequired: number; // cleaning or waiting long
}

export type TableSortOption =
  | "NUMBER_ASC"
  | "NUMBER_DESC"
  | "CAPACITY_DESC"
  | "DURATION_DESC";

export interface TableFilterParams {
  query?: string;
  status?: TableStatus | "ALL";
  section?: TableSection | "ALL";
  sortBy?: TableSortOption;
}

export type TableEventType =
  | "STATUS_CHANGED"
  | "SESSION_OPENED"
  | "SESSION_CLOSED"
  | "ORDER_LINKED"
  | "ORDER_UNLINKED"
  | "RESERVED"
  | "RESERVATION_CANCELLED";

export interface TableSubscriptionEvent {
  type: TableEventType;
  table: RestaurantTable;
  timestamp: string;
  actor?: string;
}
