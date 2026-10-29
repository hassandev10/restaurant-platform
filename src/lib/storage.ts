import { StaffUser } from "@/types/auth";

const TOKEN_KEY = "smart_restaurant_admin_jwt";
const USER_KEY = "smart_restaurant_admin_user";

export class SessionStorageManager {
  private static memoryToken: string | null = null;
  private static memoryUser: StaffUser | null = null;

  static getToken(): string | null {
    if (this.memoryToken) return this.memoryToken;
    if (typeof window === "undefined") return null;

    try {
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (token) {
        this.memoryToken = token;
        return token;
      }
    } catch {
      // storage unavailable
    }
    return null;
  }

  static getUser(): StaffUser | null {
    if (this.memoryUser) return this.memoryUser;
    if (typeof window === "undefined") return null;

    try {
      const raw = sessionStorage.getItem(USER_KEY);
      if (raw) {
        const user = JSON.parse(raw);
        this.memoryUser = user;
        return user;
      }
    } catch {
      // storage unavailable
    }
    return null;
  }

  static saveSession(token: string, user: StaffUser): void {
    this.memoryToken = token;
    this.memoryUser = user;

    if (typeof window === "undefined") return;

    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      // Also write cookie with Secure / SameSite for SSR protection
      document.cookie = `smart_admin_token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
    } catch {
      // storage write fail
    }
  }

  static clearSession(): void {
    this.memoryToken = null;
    this.memoryUser = null;

    if (typeof window === "undefined") return;

    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      document.cookie = "smart_admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    } catch {
      // ignore
    }
  }
}
