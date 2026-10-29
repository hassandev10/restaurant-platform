"use client";

import React from "react";
import Link from "next/link";
import { useCart } from "@/context/cart-context";
import { formatCurrency } from "@/lib/formatters";
import { ShoppingBag, ArrowLeft } from "lucide-react";

interface CartFloatingButtonProps {
  restaurantSlug: string;
  tableToken?: string;
}

export const CartFloatingButton: React.FC<CartFloatingButtonProps> = ({
  restaurantSlug,
  tableToken,
}) => {
  const { totalItemsCount, total, isHydrated, isTakeaway } = useCart();

  if (!isHydrated || totalItemsCount === 0) {
    return null;
  }

  const cartUrl = tableToken
    ? `/r/${restaurantSlug}/t/${tableToken}/cart`
    : isTakeaway
    ? `/r/${restaurantSlug}/takeaway/cart`
    : `/r/${restaurantSlug}/cart`;

  return (
    <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40 animate-in slide-in-from-bottom duration-300">
      <Link
        href={cartUrl}
        className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-forest-900 text-cream-50 shadow-float border border-forest-800/80 hover:bg-forest-950 transition-all active:scale-[0.99] group"
      >
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-forest-800 flex items-center justify-center text-cream-100 flex-shrink-0">
            <ShoppingBag className="w-5 h-5 text-cream-200" />
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gold-500 text-stone-950 text-xs font-black flex items-center justify-center shadow-sm">
              {totalItemsCount}
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-white group-hover:text-cream-100">
              عرض سلة الطلب
            </div>
            <div className="text-[11px] text-cream-300/80">
              {totalItemsCount === 1 ? "صنف واحد" : `${totalItemsCount} أصناف`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-cream-100 tabular-nums">
            {formatCurrency(total)}
          </span>
          <div className="w-8 h-8 rounded-full bg-forest-800 flex items-center justify-center text-cream-200 group-hover:-translate-x-1 transition-transform">
            <ArrowLeft className="w-4 h-4" />
          </div>
        </div>
      </Link>
    </div>
  );
};
