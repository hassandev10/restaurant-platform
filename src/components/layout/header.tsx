"use client";

import React, { useEffect, useState } from "react";
import { CONFIG } from "@/lib/config";
import { restaurantService } from "@/services/restaurant-service";
import { Restaurant } from "@/types/restaurant";
import { ExternalLink, Menu as MenuIcon, Store, Utensils } from "lucide-react";

interface HeaderProps {
  onOpenMobileMenu: () => void;
  pageTitle?: string;
  pageSubtitle?: string;
}

export function Header({ onOpenMobileMenu, pageTitle, pageSubtitle }: HeaderProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  useEffect(() => {
    restaurantService
      .getRestaurant()
      .then((data) => setRestaurant(data))
      .catch(() => null);
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-cream-50/90 backdrop-blur-md border-b border-cream-300 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">
      {/* Right side: Mobile Menu Trigger + Page Titles */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          type="button"
          className="md:hidden p-2 rounded-xl text-stone-700 hover:bg-cream-200 transition-colors"
          aria-label="فتح القائمة الجانبية"
        >
          <MenuIcon className="w-6 h-6" />
        </button>

        <div>
          {pageTitle && (
            <h1 className="text-xl md:text-2xl font-bold font-cairo text-stone-900 leading-tight">
              {pageTitle}
            </h1>
          )}
          {pageSubtitle && (
            <p className="text-xs text-stone-500 font-tajawal mt-0.5">{pageSubtitle}</p>
          )}
        </div>
      </div>

      {/* Left side: External project shortcuts + Restaurant Status */}
      <div className="flex items-center gap-2.5">
        {/* Restaurant Live State Badge */}
        {restaurant && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-stone-200 text-xs shadow-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                restaurant.isOpen ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="font-semibold text-stone-700">
              {restaurant.isOpen ? "المطعم يستقبل الطلبات" : "المطعم مغلق"}
            </span>
          </div>
        )}

        {/* Link to Orders Dashboard (Port 3001) */}
        <a
          href={CONFIG.ordersDashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-forest-800 border border-forest-200 hover:bg-forest-50 hover:border-forest-300 transition-colors shadow-xs"
          title="الانتقال لشاشة استلام وتحضير الطلبات الفورية في الصالة والمطبخ"
        >
          <Utensils className="w-3.5 h-3.5 text-forest-600" />
          <span className="hidden sm:inline">شاشة الطلبات الواردة</span>
          <ExternalLink className="w-3 h-3 text-stone-400" />
        </a>

        {/* Link to Customer Ordering Frontend (Port 3000) */}
        <a
          href={`${CONFIG.customerFrontendUrl}/r/${CONFIG.defaultRestaurantSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-forest-900 text-cream-100 hover:bg-forest-800 transition-colors shadow-xs"
          title="معاينة الواجهة العامة لقائمة طعام الزبائن ورموز الطاولات"
        >
          <Store className="w-3.5 h-3.5 text-gold-400" />
          <span className="hidden sm:inline">منيو الزبائن</span>
          <ExternalLink className="w-3 h-3 text-gold-300/80" />
        </a>
      </div>
    </header>
  );
}
