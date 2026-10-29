"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== "/login") {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-100 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-forest-900 text-gold-400 flex items-center justify-center shadow-float mb-4 animate-pulse">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
        <p className="text-stone-700 font-medium font-cairo">جاري التحقق من صلاحيات الدخول...</p>
      </div>
    );
  }

  if (!isAuthenticated && pathname !== "/login") {
    return (
      <div className="min-h-screen bg-cream-100 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-forest-900 text-gold-400 flex items-center justify-center shadow-float mb-4 animate-pulse">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
        <p className="text-stone-700 font-medium font-cairo">جاري التحويل لصفحة تسجيل الدخول...</p>
      </div>
    );
  }

  return <>{children}</>;
}
