"use client";

import React from "react";
import Link from "next/link";
import { Restaurant } from "@/types/restaurant";
import { RestaurantTable } from "@/types/table";
import { useCart } from "@/context/cart-context";
import { ShoppingBag, Clock, MapPin, Store, Utensils } from "lucide-react";

interface RestaurantHeaderProps {
  restaurant: Restaurant;
  table?: RestaurantTable | null;
  restaurantSlug: string;
  tableToken?: string;
}

export const RestaurantHeader: React.FC<RestaurantHeaderProps> = ({
  restaurant,
  table,
  restaurantSlug,
  tableToken,
}) => {
  const { totalItemsCount, isTakeaway } = useCart();

  const cartUrl = tableToken
    ? `/r/${restaurantSlug}/t/${tableToken}/cart`
    : isTakeaway
    ? `/r/${restaurantSlug}/takeaway/cart`
    : `/r/${restaurantSlug}/cart`;

  return (
    <header className="relative bg-white border-b border-stone-200/80 shadow-sm sticky top-0 z-30">
      <div className="max-w-3xl mx-auto px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          {/* Restaurant identity & Table badge */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-forest-800 text-cream-50 flex items-center justify-center flex-shrink-0 shadow-soft overflow-hidden border border-forest-900/10">
              <Store className="w-6 h-6 text-cream-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-stone-900 truncate">
                  {restaurant.name}
                </h1>
                {restaurant.isOpen ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    مفتوح الآن
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
                    مغلق مؤقتًا
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 truncate mt-0.5">
                {restaurant.description}
              </p>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-stone-600">
                {table ? (
                  <span
                    className="inline-flex items-center gap-1.5 font-bold text-forest-900 bg-cream-100 px-2.5 py-0.5 rounded-md border border-cream-300/80 shadow-xs"
                  >
                    <MapPin className="w-3.5 h-3.5 text-forest-700" />
                    <span>{table.name}</span>
                  </span>
                ) : isTakeaway ? (
                  <span
                    className="inline-flex items-center gap-1.5 font-bold text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200"
                  >
                    <ShoppingBag className="w-3 h-3 text-amber-700" />
                    <span>Take Away • سفري</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-forest-800 bg-forest-50 px-2.5 py-0.5 rounded-md border border-forest-100/80">
                    <Utensils className="w-3 h-3 text-forest-700" />
                    <span>تصفح المنيو</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-stone-500">
                  <Clock className="w-3 h-3 text-stone-400" />
                  ~ {restaurant.estimatedPreparationMinutes} دقيقة تحضير
                </span>
              </div>
            </div>
          </div>

          {/* Cart Icon Link */}
          <Link
            href={cartUrl}
            className="relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-forest-50 hover:bg-forest-100 text-forest-900 border border-forest-200/80 transition-all active:scale-95 flex-shrink-0"
            aria-label="عرض سلة الطلبات"
          >
            <ShoppingBag className="w-5 h-5 text-forest-800" />
            {totalItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-forest-800 text-cream-50 text-[11px] font-bold flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
                {totalItemsCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
};
