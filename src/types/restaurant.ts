export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  currency: string;
  isOpen: boolean;
  estimatedPreparationMinutes: number;
}

export interface Branch {
  id: string;
  restaurantId: string;
  name: string;
}

export type TableValidationErrorCode =
  | "EMPTY_INPUT"
  | "INVALID_FORMAT"
  | "ZERO_OR_NEGATIVE"
  | "NOT_FOUND"
  | "OUT_OF_SERVICE"
  | "NETWORK_ERROR"
  | "SERVER_ERROR";

export interface TableValidationSuccess {
  valid: true;
  table: import("./table").RestaurantTable;
  token: string;
  tableContextToken?: string;
}

export interface TableValidationFailure {
  valid: false;
  error: string;
  code: TableValidationErrorCode;
}

export type TableValidationResult = TableValidationSuccess | TableValidationFailure;
