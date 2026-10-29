"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  ClipboardList,
  History,
  LayoutDashboard,
  Plus,
  Scale,
  ShoppingCart,
} from "lucide-react";

export function InventoryNav() {
  const pathname = usePathname();

  const navLinks = [
    {
      name: "نظرة عامة",
      href: "/inventory",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      name: "أصناف المخزون",
      href: "/inventory/items",
      icon: Boxes,
      exact: false,
    },
    {
      name: "أذون التوريد والمشتريات",
      href: "/inventory/purchases",
      icon: ShoppingCart,
      exact: false,
    },
    {
      name: "التسويات والهدر والجرد",
      href: "/inventory/adjustments",
      icon: Scale,
      exact: false,
    },
    {
      name: "معايير ووصفات المنيو",
      href: "/inventory/recipes",
      icon: BookOpen,
      exact: false,
    },
    {
      name: "سجل حركات المخزون",
      href: "/inventory/movements",
      icon: History,
      exact: false,
    },
    {
      name: "التنبيهات",
      href: "/inventory/alerts",
      icon: AlertTriangle,
      exact: false,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-2 shadow-xs mb-6 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1.5 min-w-max">
        {navLinks.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-forest-900 text-gold-300 shadow-xs"
                  : "text-stone-600 hover:text-stone-900 hover:bg-cream-100"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-gold-400" : "text-stone-400"}`} />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
