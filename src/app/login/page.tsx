"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  UtensilsCrossed,
  KeyRound,
  User,
  Lock,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  Delete,
  ChefHat,
  ShieldCheck,
  CreditCard,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/orders";

  const { isAuthenticated, loginWithPin, loginWithCredentials, quickLogin, staffProfiles } = useAuth();

  const [activeTab, setActiveTab] = useState<"PIN" | "CREDENTIALS">("PIN");
  const [pin, setPin] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, redirectUrl, router]);

  // Handle PIN input button press
  const handlePinDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg(null);
      // Auto-submit on 4 digits
      if (nextPin.length === 4) {
        submitPin(nextPin);
      }
    }
  };

  const handlePinBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handlePinClear = () => {
    setPin("");
    setErrorMsg(null);
  };

  const submitPin = async (pinToSubmit: string) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const user = await loginWithPin(pinToSubmit);
      toast.success(`مرحباً بك يا ${user.name}`, {
        description: `تم تسجيل الدخول بصلاحية: ${user.roleNameAr}`,
      });
      router.replace(redirectUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تسجيل الدخول";
      setErrorMsg(msg);
      setPin("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const user = await loginWithCredentials(username, password);
      toast.success(`مرحباً بك يا ${user.name}`, {
        description: `تم تسجيل الدخول بصلاحية: ${user.roleNameAr}`,
      });
      router.replace(redirectUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "بيانات الدخول غير صحيحة";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = async (staffId: string) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const user = await quickLogin(staffId);
      toast.success(`تم الدخول الفوري: ${user.name}`, {
        description: user.roleNameAr,
      });
      router.replace(redirectUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل الدخول السريع";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for staff icons
  const getStaffIcon = (role: string) => {
    switch (role) {
      case "SUPERVISOR":
        return <ShieldCheck className="w-4 h-4 text-amber-600" />;
      case "CHEF":
        return <ChefHat className="w-4 h-4 text-blue-600" />;
      case "CASHIER":
        return <CreditCard className="w-4 h-4 text-emerald-600" />;
      case "MANAGER":
        return <Briefcase className="w-4 h-4 text-purple-600" />;
      default:
        return <User className="w-4 h-4 text-stone-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 via-cream-50 to-white flex flex-col justify-center items-center p-4 sm:p-6 font-cairo" dir="rtl">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-forest-900 text-cream-100 shadow-float mb-2 border border-forest-800">
            <UtensilsCrossed className="w-8 h-8 text-cream-200" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-900 border border-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>نظام موظفي الصالة والمطبخ (POS Terminal)</span>
          </div>
          <h1 className="text-2xl font-extrabold text-stone-900">
            مطعم الزيتونة — شاشة استلام الطلبات
          </h1>
          <p className="text-xs text-stone-500">
            فرع المعادي - القاهرة • تسجيل دخول المشغل لبدء نوبة العمل
          </p>
        </div>

        {/* Login Main Container */}
        <div className="bg-white rounded-3xl border border-stone-200/90 shadow-card p-5 sm:p-6 space-y-5">
          {/* Mode Switch Tabs */}
          <div className="flex rounded-2xl bg-stone-100 p-1 border border-stone-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setActiveTab("PIN");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "PIN"
                  ? "bg-white text-forest-900 shadow-sm font-extrabold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>رمز المرور (PIN)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("CREDENTIALS");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "CREDENTIALS"
                  ? "bg-white text-forest-900 shadow-sm font-extrabold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>اسم المستخدم</span>
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tab 1: PIN Pad (Touch Friendly for POS) */}
          {activeTab === "PIN" && (
            <div className="space-y-4">
              {/* PIN Circles Display */}
              <div className="flex flex-col items-center justify-center space-y-2 py-2">
                <span className="text-xs font-bold text-stone-500">أدخل رمز الدخول المكون من 4 أرقام:</span>
                <div className="flex items-center gap-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                        pin.length > idx
                          ? "bg-forest-800 border-forest-800 scale-110 shadow-sm"
                          : "border-stone-300 bg-stone-50"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto" dir="ltr">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handlePinDigit(digit)}
                    disabled={isSubmitting}
                    className="h-12 rounded-2xl bg-stone-50 hover:bg-forest-50 border border-stone-200 hover:border-forest-700 text-stone-800 hover:text-forest-950 font-extrabold text-lg transition-all active:scale-95 shadow-2xs flex items-center justify-center select-none"
                  >
                    {digit}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handlePinClear}
                  disabled={isSubmitting || pin.length === 0}
                  className="h-12 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-xs transition-all active:scale-95 flex items-center justify-center select-none disabled:opacity-40"
                >
                  مسح
                </button>

                <button
                  type="button"
                  onClick={() => handlePinDigit("0")}
                  disabled={isSubmitting}
                  className="h-12 rounded-2xl bg-stone-50 hover:bg-forest-50 border border-stone-200 hover:border-forest-700 text-stone-800 hover:text-forest-950 font-extrabold text-lg transition-all active:scale-95 shadow-2xs flex items-center justify-center select-none"
                >
                  0
                </button>

                <button
                  type="button"
                  onClick={handlePinBackspace}
                  disabled={isSubmitting || pin.length === 0}
                  className="h-12 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-sm transition-all active:scale-95 flex items-center justify-center select-none disabled:opacity-40"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              {isSubmitting && (
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-forest-800 pt-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق...</span>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Standard Username & Password */}
          {activeTab === "CREDENTIALS" && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 block">اسم المستخدم أو الكود:</label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: ahmed أو chef"
                    className="w-full pr-10 pl-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-forest-700/20 focus:border-forest-700 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 block">كلمة المرور أو الـ PIN:</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••"
                    className="w-full pr-10 pl-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-forest-700/20 focus:border-forest-700 transition-all font-mono"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-forest-900 hover:bg-forest-950 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <ArrowLeft className="w-4 h-4 text-cream-200" />
                )}
                <span>تسجيل الدخول للنظام</span>
              </button>
            </form>
          )}

          {/* Quick Staff Selection for Review & Shifts */}
          <div className="pt-2 border-t border-stone-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-stone-700">
                تسجيل دخول سريع لطاقم العمل (Shift Profiles):
              </span>
              <span className="text-[10px] text-stone-400">انقر للدخول المباشر</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {staffProfiles.map((staff) => (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => handleQuickLogin(staff.id)}
                  disabled={isSubmitting}
                  className="p-2.5 rounded-xl border border-stone-200 hover:border-forest-600 bg-stone-50/70 hover:bg-forest-50/50 text-right transition-all group flex items-start gap-2.5 active:scale-98"
                >
                  <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 group-hover:border-forest-300 flex items-center justify-center flex-shrink-0 transition-colors">
                    {getStaffIcon(staff.role)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-stone-900 group-hover:text-forest-900 truncate">
                      {staff.name}
                    </div>
                    <div className="text-[10px] text-stone-500 truncate">
                      {staff.roleNameAr.split(" (")[0]}
                    </div>
                    <div className="text-[10px] text-forest-700 font-mono font-bold mt-0.5" dir="ltr">
                      PIN: {staff.pin}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security / Demo footnote */}
        <div className="text-center text-xs text-stone-400 space-y-1">
          <p>نظام تشغيل المطاعم الذكي • تسجيل خروج آمن وتوثيق لكل حركة</p>
          <p className="font-mono text-[11px]">Staff Authentication Module • Smart Restaurant Egypt</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-100 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-forest-700" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
