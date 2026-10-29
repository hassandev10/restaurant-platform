"use client";

import React, { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-cream-100 flex flex-col justify-center items-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-8 shadow-card flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-forest-800" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>

      <p className="text-xs text-stone-500 mt-6 text-center">
        منظومة المطعم الذكي — حقوق النشر محفوظة © {new Date().getFullYear()}
      </p>
    </div>
  );
}
