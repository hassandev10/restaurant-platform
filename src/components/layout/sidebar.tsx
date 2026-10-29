"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Sliders,
  TableProperties,
  TicketPercent,
  UtensilsCrossed,
  ShieldCheck,
  Boxes,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    {
      name: "لوحة التحكم",
      href: "/dashboard",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      name: "إدارة المنيو",
      href: "/menu",
      icon: UtensilsCrossed,
      badge: null,
    },
    {
      name: "إدارة الطاولات",
      href: "/tables",
      icon: TableProperties,
      badge: null,
    },
    {
      name: "إدارة المخزون",
      href: "/inventory",
      icon: Boxes,
      badge: null,
    },
    {
      name: "نظرة عامة للطلبات",
      href: "/orders",
      icon: ClipboardList,
      badge: null,
    },
    {
      name: "إعدادات المطعم",
      href: "/settings",
      icon: Sliders,
      badge: null,
    },
    {
      name: "التحليلات والمبيعات",
      href: "/analytics",
      icon: BarChart3,
      badge: "عقود",
    },
    {
      name: "العروض الترويجية",
      href: "/promotions",
      icon: TicketPercent,
      badge: "عقود",
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-forest-950 text-cream-100 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between p-4 border-b border-forest-800/60 min-h-[70px]">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500 to-gold-700 text-forest-950 flex items-center justify-center font-bold font-cairo shadow-md">
              <span className="text-xl">ز</span>
            </div>
            <div>
              <h2 className="font-bold font-cairo text-base text-cream-50 leading-tight">
                مطعم الزيتونة
              </h2>
              <span className="text-[11px] text-gold-400/90 font-medium">
                بوابة الإدارة المركزية
              </span>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="mx-auto w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500 to-gold-700 text-forest-950 flex items-center justify-center font-bold font-cairo shadow-md">
            <span className="text-xl">ز</span>
          </div>
        )}

        {/* Desktop Collapse Toggle */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg bg-forest-900 hover:bg-forest-800 text-cream-300 hover:text-white transition-colors"
          title={collapsed ? "توسيع القائمة" : "طي القائمة"}
        >
          {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-forest-800 text-gold-300 shadow-sm font-semibold border-r-4 border-gold-400"
                  : "text-cream-300/80 hover:bg-forest-900 hover:text-white"
              } ${collapsed ? "justify-center px-2" : ""}`}
              title={collapsed ? item.name : undefined}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-gold-400" : "text-cream-400"}`} />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between">
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-forest-800/80 text-gold-300 border border-gold-400/30">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-forest-800/60 bg-forest-900/60">
        {!collapsed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-forest-950/70 border border-forest-800/40">
              <div className="w-9 h-9 rounded-full bg-forest-800 text-gold-300 flex items-center justify-center font-bold text-xs shrink-0 border border-gold-400/30">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-cream-50 truncate font-cairo">
                  {user?.name || "المشرف العام"}
                </p>
                <p className="text-[10px] text-gold-400 truncate">
                  {user?.roleNameAr || "مدير النظام"}
                </p>
              </div>
            </div>

            <button
              onClick={logout}
              type="button"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-red-300 hover:text-red-200 bg-red-950/30 hover:bg-red-950/60 rounded-xl border border-red-900/30 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-9 h-9 rounded-full bg-forest-800 text-gold-300 flex items-center justify-center"
              title={`${user?.name} (${user?.role})`}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
            <button
              onClick={logout}
              type="button"
              className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-200 rounded-lg hover:bg-red-950/40 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:block shrink-0 transition-all duration-300 h-screen sticky top-0 border-l border-forest-800/30 z-30 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-right duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
