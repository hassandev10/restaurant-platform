"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SessionStorageManager } from "@/lib/storage";
import { authService } from "@/services/auth-service";
import { StaffUser } from "@/types/auth";

interface AuthContextType {
  user: StaffUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, pinOrPass: string) => Promise<StaffUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = SessionStorageManager.getUser();
        if (storedUser) {
          setUser(storedUser);
          // Verify with backend silently
          const me = await authService.getMe();
          if (!me) {
            // Token expired or invalid
            SessionStorageManager.clearSession();
            setUser(null);
          }
        }
      } catch {
        SessionStorageManager.clearSession();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username: string, pinOrPass: string): Promise<StaffUser> => {
    setIsLoading(true);
    try {
      const authenticatedUser = await authService.login(username, pinOrPass);
      setUser(authenticatedUser);
      toast.success(`مرحباً بك مجدداً، ${authenticatedUser.name}`);
      return authenticatedUser;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تسجيل الدخول";
      toast.error(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    toast.info("تم تسجيل الخروج بنجاح");
    router.push("/login");
  };

  const refreshUser = async () => {
    const me = await authService.getMe();
    if (me && user) {
      const updated: StaffUser = {
        ...user,
        username: me.username,
        name: me.name,
      };
      setUser(updated);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
