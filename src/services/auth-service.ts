import { authRpc } from "@/lib/rpc-client";
import { SessionStorageManager } from "@/lib/storage";
import { BackendMeResponse, StaffRole, StaffUser } from "@/types/auth";

export class AuthService {
  private mapBackendRole(role: string): { role: StaffRole; roleNameAr: string } {
    const upper = (role || "").toUpperCase();
    if (upper === "ADMIN") {
      return { role: "ADMIN", roleNameAr: "مدير النظام العام (System Administrator)" };
    }
    if (upper === "SUPERVISOR") {
      return { role: "SUPERVISOR", roleNameAr: "مشرف الصالة (Head Supervisor)" };
    }
    if (upper === "KITCHEN" || upper === "CHEF") {
      return { role: "CHEF", roleNameAr: "رئيس المطبخ (Executive Chef)" };
    }
    if (upper === "CASHIER") {
      return { role: "CASHIER", roleNameAr: "كاشير ومحاسب (Head Cashier)" };
    }
    return { role: "MANAGER", roleNameAr: "مدير العمليات (Operations Manager)" };
  }

  async login(username: string, password: string): Promise<StaffUser> {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      throw new Error("يرجى إدخال اسم المستخدم وكلمة المرور");
    }

    try {
      const res = await authRpc.login({ username: cleanUser, password: cleanPass });
      if (!res.user) throw new Error("بيانات المستخدم غير موجودة");

      const roleStr =
        res.user.role === 1 ? "ADMIN"
        : res.user.role === 2 ? "MANAGER"
        : res.user.role === 3 ? "WAITER"
        : res.user.role === 4 ? "KITCHEN"
        : res.user.role === 5 ? "CASHIER"
        : "ADMIN";

      const { role, roleNameAr } = this.mapBackendRole(roleStr);

      const user: StaffUser = {
        id: res.user.id,
        name: res.user.name,
        username: res.user.username,
        role,
        roleNameAr,
        restaurantId: res.user.restaurantId || "rest-01",
        restaurantName: "مطعم الزيتونة",
        branchId: res.user.branchId || "branch-01",
        branchName: "فرع المعادي - القاهرة",
        isActive: res.user.isActive,
        token: res.token,
        loginTime: new Date().toISOString(),
      };

      SessionStorageManager.saveSession(res.token, user);
      return user;
    } catch (err: any) {
      const msg = err?.message || err?.rawMessage || "فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.";
      throw new Error(msg);
    }
  }

  async getMe(): Promise<BackendMeResponse | null> {
    const token = SessionStorageManager.getToken();
    if (!token) return null;

    try {
      const res = await authRpc.getMe({});
      if (!res.user) return null;
      return {
        userId: res.user.id,
        restaurantId: res.user.restaurantId,
        branchId: res.user.branchId,
        username: res.user.username,
        name: res.user.name,
        role: "ADMIN",
      };
    } catch {
      return null;
    }
  }

  getCurrentUser(): StaffUser | null {
    return SessionStorageManager.getUser();
  }

  isAuthenticated(): boolean {
    return !!SessionStorageManager.getToken() && !!SessionStorageManager.getUser();
  }

  logout(): void {
    SessionStorageManager.clearSession();
  }
}

export const authService = new AuthService();
