"use client";

import React, { useState } from "react";
import Image from "next/image";
import { CartItem as CartItemType } from "@/types/cart";
import { useCart } from "@/context/cart-context";
import { PriceDisplay } from "@/components/shared/price-display";
import { Plus, Minus, Trash2 } from "lucide-react";

interface CartItemProps {
  item: CartItemType;
}

export const CartItemRow: React.FC<CartItemProps> = ({ item }) => {
  const { updateQuantity, removeItem } = useCart();
  const [imageError, setImageError] = useState(false);

  return (
    <div className="flex flex-col p-4 bg-white rounded-2xl border border-stone-200/80 shadow-sm gap-3">
      <div className="flex items-start gap-3">
        {/* Item Thumbnail - only displayed when real image exists */}
        {!imageError && Boolean(item.imageUrlSnapshot?.trim()) && (
          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0 border border-stone-200/60">
            <Image
              src={item.imageUrlSnapshot}
              alt={item.productNameSnapshot}
              fill
              sizes="64px"
              className="object-cover"
              onError={() => setImageError(true)}
            />
          </div>
        )}

        {/* Item Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <h4 className="text-sm font-bold text-stone-900 leading-snug">
              {item.productNameSnapshot}
            </h4>
            <button
              onClick={() => removeItem(item.id)}
              className="text-stone-400 hover:text-rose-600 transition-colors p-1"
              aria-label="حذف الصنف من السلة"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Selected Options Badges */}
          {item.selectedOptions && item.selectedOptions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.selectedOptions.map((opt, i) => (
                <span
                  key={i}
                  className="inline-block text-[11px] font-medium bg-cream-100 text-stone-700 px-2 py-0.5 rounded-md border border-stone-200/60"
                >
                  {opt.optionNameAr}
                  {opt.priceDelta > 0 && (
                    <span className="text-forest-700 mr-1">
                      (+{opt.priceDelta} ج.م)
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Special Notes */}
          {item.notes && (
            <p className="text-[11px] text-amber-900/90 bg-amber-50/80 border border-amber-200/60 rounded-md px-2 py-1 mt-1.5">
              <strong>ملاحظات:</strong> {item.notes}
            </p>
          )}
        </div>
      </div>

      {/* Footer: Quantity Controls & Line Total */}
      <div className="flex items-center justify-between pt-2 border-t border-stone-100">
        <PriceDisplay amount={item.lineTotal} size="md" />

        <div className="flex items-center bg-stone-50 border border-stone-200/80 rounded-xl p-0.5">
          <button
            type="button"
            onClick={() => updateQuantity(item.id, item.quantity - 1)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-200/70 transition-colors"
            aria-label="تقليل الكمية"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-7 text-center text-xs font-bold text-stone-800 tabular-nums">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => updateQuantity(item.id, item.quantity + 1)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-200/70 transition-colors"
            aria-label="زيادة الكمية"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
