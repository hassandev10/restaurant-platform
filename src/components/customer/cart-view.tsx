"use client";

import React from "react";
import Link from "next/link";
import { Restaurant } from "@/types/restaurant";
import { RestaurantTable } from "@/types/table";
import { useCart } from "@/context/cart-context";
import { CartItemRow } from "@/components/customer/cart-item";
import { CartSummary } from "@/components/customer/cart-summary";
import { EmptyState } from "@/components/shared/empty-state";
import { ArrowRight, ShoppingBag, UtensilsCrossed, Trash2 } from "lucide-react";

interface CartViewProps {
  restaurant: Restaurant;
  table?: RestaurantTable | null;
  restaurantSlug: string;
  tableToken?: string;
}

export const CartView: React.FC<CartViewProps> = ({
  restaurant,
  table,
  restaurantSlug,
  tableToken,
}) => {
  const { items, clearCart, isHydrated, totalItemsCount, isTakeaway } = useCart();

  const menuUrl = tableToken
    ? `/r/${restaurantSlug}/t/${tableToken}`
    : isTakeaway
    ? `/r/${restaurantSlug}/takeaway`
    : `/r/${restaurantSlug}`;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 pb-20">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-200/80">
        <Link
          href={menuUrl}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-forest-800 hover:text-forest-950 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>الرجوع إلى المنيو</span>
        </Link>

        {items.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-rose-600 transition-colors"
            title="تفريغ السلة بالكامل"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>تفريغ السلة</span>
          </button>
        )}
      </div>

      {/* Cart Title & Table Badge */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
            سلة الطلبات
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            {restaurant.name} • {table ? table.name : isTakeaway ? "طلب سفري (Take Away)" : "طلب مباشر"}
          </p>
        </div>
        {totalItemsCount > 0 && (
          <span className="px-3 py-1 rounded-full bg-forest-100 text-forest-800 text-xs font-bold border border-forest-200">
            {totalItemsCount} {totalItemsCount === 1 ? "صنف" : "أصناف"}
          </span>
        )}
      </div>

      {/* Cart Content */}
      {isHydrated && items.length > 0 ? (
        <div className="space-y-5">
          {/* List of Cart Items */}
          <div className="space-y-2.5">
            {items.map((item) => (
              <CartItemRow key={item.id} item={item} />
            ))}
          </div>

          {/* Add more dishes button */}
          <div className="text-center pt-1">
            <Link
              href={menuUrl}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-forest-700 hover:text-forest-900 bg-white border border-stone-200 px-4 py-2 rounded-xl shadow-xs transition-colors"
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>إضافة أطباق أو مشروبات أخرى</span>
            </Link>
          </div>

          {/* Cart Bill Breakdown & Order Submission */}
          <CartSummary
            restaurant={restaurant}
            table={table}
            restaurantSlug={restaurantSlug}
            tableToken={tableToken}
          />
        </div>
      ) : isHydrated && items.length === 0 ? (
        <EmptyState
          title="سلة الطلبات فارغة"
          description="لم تقم بإضافة أي وجبات أو مشروبات إلى طلبك حتى الآن. استكشف قائمتنا الشهية واختر ما يعجبك!"
          icon={ShoppingBag}
          action={
            <Link
              href={menuUrl}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs sm:text-sm font-bold shadow-soft transition-all"
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>تصفح قائمة الطعام الآن</span>
            </Link>
          }
        />
      ) : null}
    </div>
  );
};
