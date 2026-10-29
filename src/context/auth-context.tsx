"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { StaffUser } from "@/types/auth";
import { authRepository } from "@/repositories/auth-repository";

interface AuthContextType {
  user: StaffUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithPin: (pin: string) => Promise<StaffUser>;
  loginWithCredentials: (username: string, pass: string) => Promise<StaffUser>;
  quickLogin: (userId: string) => Promise<StaffUser>;
  logout: () => Promise<void>;
  staffProfiles: StaffUser[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const staffProfiles = authRepository.getAvailableStaffProfiles();

  // Restore session on mount
  useEffect(() => {
    const existing = authRepository.getCurrentUser();
    if (existing) {
      setUser(existing);
    }
    setIsLoading(false);
  }, []);

  const loginWithPin = useCallback(async (pin: string) => {
    const authenticated = await authRepository.loginWithPin(pin);
    setUser(authenticated);
    return authenticated;
  }, []);

  const loginWithCredentials = useCallback(async (username: string, pass: string) => {
    const authenticated = await authRepository.loginWithCredentials(username, pass);
    setUser(authenticated);
    return authenticated;
  }, []);

  const quickLogin = useCallback(async (userId: string) => {
    const target = authRepository.getAvailableStaffProfiles().find((s) => s.id === userId);
    if (!target) throw new Error("المستخدم غير موجود");
    const authenticated = await authRepository.loginWithCredentials(target.username, "password123");
    setUser(authenticated);
    return authenticated;
  }, []);

  const logout = useCallback(async () => {
    await authRepository.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginWithPin,
        loginWithCredentials,
        quickLogin,
        logout,
        staffProfiles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
