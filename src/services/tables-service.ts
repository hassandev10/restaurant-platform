import { apiClient } from "@/lib/api-client";
import {
  CreateTableRequest,
  PaginatedTablesResponse,
  RestaurantTable,
  TableFilterQuery,
  TableQRResponse,
  TableSection,
  UpdateTableRequest,
} from "@/types/table";

export interface ITablesService {
  listTables(filter?: TableFilterQuery): Promise<PaginatedTablesResponse>;
  getTable(tableId: string): Promise<RestaurantTable>;
  createTable(req: CreateTableRequest): Promise<RestaurantTable>;
  updateTable(tableId: string, req: UpdateTableRequest): Promise<RestaurantTable>;
  getTableQR(tableId: string): Promise<TableQRResponse>;
  regenerateQR(tableId: string): Promise<TableQRResponse>;
  listSections(): Promise<TableSection[]>;
  createSection(name: string, displayOrder?: number): Promise<TableSection>;
}

export class TablesService implements ITablesService {
  async listTables(filter: TableFilterQuery = {}): Promise<PaginatedTablesResponse> {
    return await apiClient.get<PaginatedTablesResponse>("/api/v1/tables", {
      status: filter.status,
      sectionId: filter.sectionId,
      search: filter.search,
      page: filter.page || 1,
      pageSize: filter.pageSize || 50,
    });
  }

  async getTable(tableId: string): Promise<RestaurantTable> {
    return await apiClient.get<RestaurantTable>(`/api/v1/tables/${tableId}`);
  }

  async createTable(req: CreateTableRequest): Promise<RestaurantTable> {
    return await apiClient.post<RestaurantTable>("/api/v1/tables", req);
  }

  async updateTable(tableId: string, req: UpdateTableRequest): Promise<RestaurantTable> {
    return await apiClient.patch<RestaurantTable>(`/api/v1/tables/${tableId}`, req);
  }

  async getTableQR(tableId: string): Promise<TableQRResponse> {
    return await apiClient.get<TableQRResponse>(`/api/v1/tables/${tableId}/qr`);
  }

  async regenerateQR(tableId: string): Promise<TableQRResponse> {
    return await apiClient.post<TableQRResponse>(`/api/v1/tables/${tableId}/qr/regenerate`);
  }

  async listSections(): Promise<TableSection[]> {
    return await apiClient.get<TableSection[]>("/api/v1/sections");
  }

  async createSection(name: string, displayOrder: number = 0): Promise<TableSection> {
    return await apiClient.post<TableSection>("/api/v1/sections", { name, displayOrder });
  }
}

export const tablesService = new TablesService();
