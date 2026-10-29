"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { RefreshCw, UtensilsCrossed } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== "/login") {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="w-14 h-14 rounded-3xl bg-forest-900 text-cream-100 flex items-center justify-center mb-4 shadow-float border border-forest-800">
          <UtensilsCrossed className="w-7 h-7 text-cream-200" />
        </div>
        <RefreshCw className="w-6 h-6 animate-spin text-forest-700 mb-2" />
        <p className="text-xs font-bold text-stone-600">جاري التحقق من صلاحية المشغل...</p>
      </div>
    );
  }

  if (!isAuthenticated && pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
};
