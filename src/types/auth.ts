export type StaffRole = "SUPERVISOR" | "CHEF" | "CASHIER" | "MANAGER";

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  pin: string; // 4-digit POS quick pin (e.g. "1234")
  role: StaffRole;
  roleNameAr: string;
  restaurantId: string;
  restaurantName: string;
  branchId: string;
  branchName: string;
  token?: string;
  shiftStartedAt?: string;
  avatarUrl?: string;
}

export interface AuthSession {
  user: StaffUser;
  token: string;
  loginTime: string;
}
