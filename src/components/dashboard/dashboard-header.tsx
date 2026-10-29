"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  UtensilsCrossed,
  Clock,
  Volume2,
  VolumeX,
  PlusCircle,
  History,
  LayoutDashboard,
  Layers,
  Loader2,
  UserCheck,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { isSoundNotificationEnabled, setSoundNotificationEnabled, playNewOrderChime } from "@/lib/sound";
import { toast } from "sonner";

interface DashboardHeaderProps {
  restaurantName?: string;
  branchName?: string;
  staffName?: string;
  newOrdersCount?: number;
  onSimulateOrder?: () => Promise<void>;
  isSimulating?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  restaurantName = "مطعم الزيتونة",
  branchName = "فرع المعادي - القاهرة",
  staffName: propStaffName,
  newOrdersCount = 0,
  onSimulateOrder,
  isSimulating = false,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  const activeStaffName = user?.name || propStaffName || "الكابتن أحمد حسن";
  const activeStaffRole = user?.roleNameAr || "مشرف الصالة (Head Supervisor)";

  // Sync sound settings
  useEffect(() => {
    setSoundEnabled(isSoundNotificationEnabled());
  }, []);

  // Update live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        new Intl.DateTimeFormat("ar-EG", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(now)
      );
      setCurrentDate(
        new Intl.DateTimeFormat("ar-EG", {
          weekday: "long",
          day: "numeric",
          month: "short",
        }).format(now)
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    setSoundNotificationEnabled(nextState);
    if (nextState) {
      playNewOrderChime();
      toast.success("تم تفعيل التنبيهات الصوتية للطلبات الجديدة 🔔");
    } else {
      toast.info("تم كتم التنبيهات الصوتية 🔕");
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.info("تم تسجيل الخروج بنجاح");
    router.replace("/login");
  };

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm font-cairo">
      {/* Top Banner for Live Server Connection Status */}
      <div className="bg-forest-950 text-cream-100 px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-forest-900">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            متصل بالسيرفر المباشر (Live Server Connected)
          </span>
          <span className="text-stone-300 hidden sm:inline">
            متصل بقاعدة البيانات وسيرفر Go المباشر على المنفذ 8080 • تحديثات فورية
          </span>
        </div>

        <div className="flex items-center gap-4 text-stone-300 text-[11px]">
          {/* User Profile Pill / Dropdown in Top Banner */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-1.5 hover:text-white transition-colors bg-white/10 px-2 py-0.5 rounded-md"
            >
              <UserCheck className="w-3.5 h-3.5 text-cream-200" />
              <span>المشغل:</span>
              <span className="font-semibold text-white">{activeStaffName}</span>
              <ChevronDown className="w-3 h-3 text-cream-300" />
            </button>

            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1.5 w-60 rounded-2xl bg-white shadow-xl border border-stone-200 text-stone-800 p-3 z-50 animate-in fade-in zoom-in-95 space-y-2.5" dir="rtl">
                  <div className="border-b border-stone-100 pb-2">
                    <div className="font-extrabold text-xs text-stone-900">{activeStaffName}</div>
                    <div className="text-[11px] text-forest-800 font-bold mt-0.5">
                      {activeStaffRole}
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                      {branchName}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Link
                      href="/login"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-100 transition-colors"
                    >
                      <span>تبديل المشغل (Switch User)</span>
                      <UserCheck className="w-3.5 h-3.5 text-stone-500" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors"
                    >
                      <span>تسجيل الخروج (Logout)</span>
                      <LogOut className="w-3.5 h-3.5 text-rose-600" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Operational Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Restaurant Brand & Active Nav */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-forest-900 text-cream-100 flex items-center justify-center shadow-sm">
              <UtensilsCrossed className="w-6 h-6 text-cream-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-stone-900 leading-tight">
                  {restaurantName}
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 font-medium">
                  {branchName}
                </span>
              </div>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                شاشة استلام وإدارة الطلبات الواردة (Live Orders POS)
              </p>
            </div>
          </div>

          {/* Navigation links for tablet/mobile */}
          <div className="flex items-center gap-1.5 md:hidden">
            <Link
              href="/orders"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pathname === "/orders"
                  ? "bg-forest-900 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              الطلبات
            </Link>
            <Link
              href="/tables"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pathname === "/tables"
                  ? "bg-forest-900 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              الطاولات
            </Link>
            <Link
              href="/orders/history"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pathname === "/orders/history"
                  ? "bg-forest-900 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              السجل
            </Link>
          </div>
        </div>

        {/* Operational Controls & Live Status */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5">
          {/* Navigation Tabs for Desktop */}
          <div className="hidden md:flex items-center gap-1 bg-stone-100/90 p-1 rounded-xl border border-stone-200">
            <Link
              href="/orders"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pathname === "/orders"
                  ? "bg-white text-forest-900 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>الطلبات الواردة</span>
              {newOrdersCount > 0 && (
                <span className="mr-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                  {newOrdersCount}
                </span>
              )}
            </Link>

            <Link
              href="/tables"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pathname === "/tables"
                  ? "bg-white text-forest-900 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>إدارة الطاولات</span>
            </Link>

            <Link
              href="/orders/history"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pathname === "/orders/history"
                  ? "bg-white text-forest-900 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>سجل الطلبات</span>
            </Link>
          </div>

          {/* Live Arabic Clock */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-700 text-xs">
            <Clock className="w-3.5 h-3.5 text-forest-700" />
            <span className="font-bold text-stone-900 font-mono tracking-tight" dir="ltr">
              {currentTime || "--:--:--"}
            </span>
            <span className="text-stone-400 text-[11px] hidden lg:inline">
              {currentDate}
            </span>
          </div>

          {/* Sound Toggle Button */}
          <button
            type="button"
            onClick={handleToggleSound}
            title={soundEnabled ? "كتم صوت التنبيهات" : "تفعيل صوت التنبيهات"}
            className={`p-2 rounded-xl border transition-all text-xs font-medium flex items-center gap-1.5 active:scale-95 ${
              soundEnabled
                ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                : "bg-stone-100 border-stone-200 text-stone-500 hover:bg-stone-200"
            }`}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-700" />
                <span className="hidden xl:inline text-xs font-bold">الصوت مفعل</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-stone-400" />
                <span className="hidden xl:inline text-xs font-bold">صامت</span>
              </>
            )}
          </button>

          {/* Quick Demo Simulator Trigger */}
          {onSimulateOrder && (
            <button
              type="button"
              onClick={onSimulateOrder}
              disabled={isSimulating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              {isSimulating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <PlusCircle className="w-3.5 h-3.5 text-cream-200" />
              )}
              <span>محاكاة طلب جديد</span>
            </button>
          )}

          {/* Direct Logout / User button for quick access */}
          <button
            type="button"
            onClick={handleLogout}
            title="تسجيل الخروج"
            className="p-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 text-stone-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
