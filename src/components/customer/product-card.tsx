"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Product } from "@/types/menu";
import { PriceDisplay } from "@/components/shared/price-display";
import { Plus, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  const [imageError, setImageError] = useState(false);
  const hasOptions = product.options && product.options.length > 0;
  const showImage = !imageError && Boolean(product.imageUrl?.trim());

  return (
    <div
      onClick={() => product.isAvailable && onSelect(product)}
      className={cn(
        "group relative flex flex-row items-stretch bg-white rounded-2xl border border-stone-200/80 p-3 sm:p-4 gap-3.5 transition-all duration-200 shadow-sm",
        product.isAvailable
          ? "hover:border-forest-700/40 hover:shadow-card cursor-pointer active:scale-[0.99]"
          : "opacity-60 bg-stone-50 cursor-not-allowed"
      )}
    >
      {/* Product Image Thumbnail - only displayed when a real image exists */}
      {showImage && (
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0 border border-stone-200/50">
          <Image
            src={product.imageUrl!}
            alt={product.nameAr}
            fill
            sizes="(max-width: 640px) 96px, 112px"
            className={cn(
              "object-cover transition-transform duration-300 group-hover:scale-105",
              !product.isAvailable && "grayscale"
            )}
            onError={() => setImageError(true)}
          />

          {/* Unavailable overlay over image */}
          {!product.isAvailable && (
            <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-[1px] flex items-center justify-center p-1 text-center">
              <span className="text-[11px] font-bold text-white bg-rose-600/90 px-2 py-0.5 rounded-md">
                غير متاح اليوم
              </span>
            </div>
          )}
        </div>
      )}

      {/* Product Content Details */}
      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div>
          {/* Badge & Name */}
          <div className="flex items-start justify-between gap-1 mb-1">
            <h3 className="text-sm sm:text-base font-bold text-stone-900 group-hover:text-forest-900 transition-colors line-clamp-1">
              {product.nameAr}
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* If no image and unavailable, show badge here */}
              {!showImage && !product.isAvailable && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                  غير متاح
                </span>
              )}
              {product.badge && product.isAvailable && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-100 text-gold-800 border border-gold-200/60">
                  {product.badge}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed mb-2">
            {product.description}
          </p>
        </div>

        {/* Price & Action Button */}
        <div className="flex items-center justify-between pt-1 border-t border-stone-100/90">
          <PriceDisplay amount={product.price} size="md" />

          {product.isAvailable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(product);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95",
                hasOptions
                  ? "bg-cream-200 hover:bg-forest-100 text-forest-800 border border-forest-200/60"
                  : "bg-forest-800 hover:bg-forest-700 text-cream-50 shadow-soft"
              )}
            >
              {hasOptions ? (
                <>
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>تخصيص</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة</span>
                </>
              )}
            </button>
          ) : (
            <span className="text-xs text-stone-400 font-medium">غير متاح</span>
          )}
        </div>
      </div>
    </div>
  );
};
