export type StaffRole = "ADMIN" | "SUPERVISOR" | "CHEF" | "CASHIER" | "MANAGER";

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  role: StaffRole;
  roleNameAr: string;
  restaurantId: string;
  restaurantName?: string;
  branchId?: string;
  branchName?: string;
  isActive: boolean;
  token?: string;
  loginTime?: string;
}

export interface BackendLoginResponse {
  token: string;
  user: {
    id: string;
    restaurantId: string;
    branchId: string;
    username: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt?: string;
  };
}

export interface BackendMeResponse {
  userId: string;
  restaurantId: string;
  branchId: string;
  username: string;
  name: string;
  role: string;
}
