import { StaffUser, StaffRole } from "@/types/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
const SESSION_STORAGE_KEY = "smart_restaurant_staff_session_v1";

export interface IAuthRepository {
  loginWithPin(pin: string): Promise<StaffUser>;
  loginWithCredentials(username: string, pinOrPass: string): Promise<StaffUser>;
  getCurrentUser(): StaffUser | null;
  logout(): Promise<void>;
  getAvailableStaffProfiles(): StaffUser[];
}

interface BackendLoginResponse {
  token: string;
  user: {
    id: string;
    restaurantId: string;
    branchId: string;
    username: string;
    name: string;
    role: string;
    isActive: boolean;
  };
}

export class ApiAuthRepository implements IAuthRepository {
  private currentStaff: StaffUser | null = null;

  constructor() {
    this.restoreSession();
  }

  private mapBackendRole(role: string): { role: StaffRole; roleNameAr: string } {
    const upper = role.toUpperCase();
    if (upper === "ADMIN" || upper === "SUPERVISOR") {
      return { role: "SUPERVISOR", roleNameAr: "مشرف الصالة (Head Supervisor)" };
    }
    if (upper === "KITCHEN" || upper === "CHEF") {
      return { role: "CHEF", roleNameAr: "رئيس المطبخ (Executive Chef)" };
    }
    if (upper === "CASHIER") {
      return { role: "CASHIER", roleNameAr: "كاشير ومحاسب (Head Cashier)" };
    }
    return { role: "MANAGER", roleNameAr: "مدير المطعم (General Manager)" };
  }

  private restoreSession(): void {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        this.currentStaff = JSON.parse(stored);
      }
    } catch {
      this.currentStaff = null;
    }
  }

  private persistSession(user: StaffUser | null): void {
    if (typeof window === "undefined") return;
    try {
      if (user) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore localStorage write error
    }
  }

  getAvailableStaffProfiles(): StaffUser[] {
    return [
      {
        id: "staff-01",
        name: "الكابتن أحمد حسن",
        username: "admin",
        pin: "1234",
        role: "SUPERVISOR",
        roleNameAr: "مشرف الصالة (Head Supervisor)",
        restaurantId: "rest-01",
        restaurantName: "مطعم الزيتونة",
        branchId: "branch-01",
        branchName: "فرع المعادي - القاهرة",
      },
      {
        id: "staff-02",
        name: "الشيف محمود إبراهيم",
        username: "kitchen",
        pin: "5678",
        role: "CHEF",
        roleNameAr: "رئيس المطبخ (Executive Chef)",
        restaurantId: "rest-01",
        restaurantName: "مطعم الزيتونة",
        branchId: "branch-01",
        branchName: "فرع المعادي - القاهرة",
      },
    ];
  }

  getCurrentUser(): StaffUser | null {
    if (!this.currentStaff && typeof window !== "undefined") {
      this.restoreSession();
    }
    return this.currentStaff;
  }

  async loginWithCredentials(username: string, pinOrPass: string): Promise<StaffUser> {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = pinOrPass.trim();

    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: cleanUser,
        password: cleanPass,
      }),
    });

    if (!res.ok) {
      let errorText = "اسم المستخدم أو كلمة المرور غير صحيحة.";
      try {
        const errorJson = await res.json();
        if (errorJson.error) errorText = errorJson.error;
      } catch {
        // fallback
      }
      throw new Error(errorText);
    }

    const data: BackendLoginResponse = await res.json();
    const { role, roleNameAr } = this.mapBackendRole(data.user.role);

    const authenticatedUser: StaffUser = {
      id: data.user.id,
      name: data.user.name,
      username: data.user.username,
      pin: cleanPass.length === 4 ? cleanPass : "1234",
      role,
      roleNameAr,
      restaurantId: data.user.restaurantId || "rest-01",
      restaurantName: "مطعم الزيتونة",
      branchId: data.user.branchId || "branch-01",
      branchName: "فرع المعادي - القاهرة",
      token: data.token,
      shiftStartedAt: new Date().toISOString(),
    };

    this.currentStaff = authenticatedUser;
    this.persistSession(authenticatedUser);
    return authenticatedUser;
  }

  async loginWithPin(pin: string): Promise<StaffUser> {
    const cleanPin = pin.trim();

    // Map staff PINs to credentials
    let username = "admin";
    let password = "password123";

    if (cleanPin === "5678") {
      username = "kitchen";
      password = "password123";
    } else if (cleanPin === "1234" || cleanPin === "8888") {
      username = "admin";
      password = "password123";
    } else {
      // Direct pass attempt
      username = "admin";
      password = cleanPin;
    }

    try {
      const user = await this.loginWithCredentials(username, password);
      user.pin = cleanPin;
      this.currentStaff = user;
      this.persistSession(user);
      return user;
    } catch {
      throw new Error("رمز الدخول (PIN) غير صحيح. يرجى التأكد والمحاولة مرة أخرى.");
    }
  }

  async logout(): Promise<void> {
    this.currentStaff = null;
    this.persistSession(null);
  }
}

export const authRepository: IAuthRepository = new ApiAuthRepository();
