"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { KeyRound, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = loginSchema.safeParse({ username, password });
    if (!validation.success) {
      setError(validation.error.errors[0]?.message || "بيانات الدخول غير مكتملة");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(username, password);
      router.push(redirect);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillCredentials = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setError(null);
  };

  return (
    <div className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-8 shadow-card">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-forest-900 text-gold-400 flex items-center justify-center shadow-md mb-4 border border-forest-800">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-stone-900 font-cairo">
          تسجيل الدخول للإدارة
        </h2>
        <p className="text-sm text-stone-500 mt-1">
          لوحة تحكم المشرفين والمدراء لمنصة المطعم الذكي
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5 animate-in fade-in">
          <Lock className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
            اسم المستخدم (Username)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-stone-400">
              <User className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: admin"
              dir="ltr"
              autoComplete="username"
              className="w-full pl-4 pr-11 py-3 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700 focus:border-transparent transition text-stone-900"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
            كلمة المرور (Password)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-stone-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              autoComplete="current-password"
              className="w-full pl-4 pr-11 py-3 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700 focus:border-transparent transition text-stone-900"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 px-4 bg-forest-900 hover:bg-forest-800 disabled:bg-stone-300 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 text-sm mt-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>جاري التحقق من بيانات الدخول...</span>
            </>
          ) : (
            <span>دخول لوحة الإدارة</span>
          )}
        </button>
      </form>

      {/* Quick Credentials Helper */}
      <div className="mt-8 pt-6 border-t border-stone-200">
        <p className="text-xs font-bold text-stone-500 mb-2.5 text-center">
          حسابات تجريبية معرفة في خادم Go Backend:
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleFillCredentials("admin", "password123")}
            className="p-2.5 rounded-xl border border-stone-200 hover:border-forest-600 bg-cream-50/50 hover:bg-forest-50/50 text-right transition group"
          >
            <div className="font-bold text-stone-800 group-hover:text-forest-800 font-cairo">
              المشرف العام (Admin)
            </div>
            <div className="text-[11px] text-stone-500 font-mono mt-0.5" dir="ltr">
              admin / password123
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleFillCredentials("kitchen", "password123")}
            className="p-2.5 rounded-xl border border-stone-200 hover:border-forest-600 bg-cream-50/50 hover:bg-forest-50/50 text-right transition group"
          >
            <div className="font-bold text-stone-800 group-hover:text-forest-800 font-cairo">
              رئيس المطبخ (Kitchen)
            </div>
            <div className="text-[11px] text-stone-500 font-mono mt-0.5" dir="ltr">
              kitchen / password123
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
