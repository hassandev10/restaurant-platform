"use client";

import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { Product, ProductOptionGroup } from "@/types/menu";
import { SelectedOptionSnapshot } from "@/types/cart";
import { useCart } from "@/context/cart-context";
import { PriceDisplay } from "@/components/shared/price-display";
import { formatCurrency } from "@/lib/formatters";
import { X, Plus, Minus, Check, AlertCircle, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProductDetailsModalProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  product,
  onClose,
}) => {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedOptionMap, setSelectedOptionMap] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState("");
  const [imageError, setImageError] = useState(false);

  // Initialize defaults whenever product changes
  useEffect(() => {
    if (!product) return;
    setQuantity(1);
    setNotes("");
    setImageError(false);

    // Preselect first available option for REQUIRED single-select groups
    const initialMap: Record<string, string[]> = {};
    product.options.forEach((group) => {
      if (group.isRequired && group.selectionType === "SINGLE") {
        const firstAvailable = group.options.find((opt) => opt.isAvailable);
        if (firstAvailable) {
          initialMap[group.id] = [firstAvailable.id];
        }
      } else {
        initialMap[group.id] = [];
      }
    });

    setSelectedOptionMap(initialMap);
  }, [product]);

  // Handle single option selection
  const handleSingleSelect = (groupId: string, optionId: string) => {
    setSelectedOptionMap((prev) => ({
      ...prev,
      [groupId]: [optionId],
    }));
  };

  // Handle multiple option selection
  const handleMultipleToggle = (group: ProductOptionGroup, optionId: string) => {
    setSelectedOptionMap((prev) => {
      const current = prev[group.id] || [];
      const isSelected = current.includes(optionId);

      if (isSelected) {
        return {
          ...prev,
          [group.id]: current.filter((id) => id !== optionId),
        };
      } else {
        if (group.maxSelections && current.length >= group.maxSelections) {
          return prev; // Reached max
        }
        return {
          ...prev,
          [group.id]: [...current, optionId],
        };
      }
    });
  };

  // Check required groups validation
  const validationErrors = useMemo(() => {
    if (!product) return [];
    const errors: string[] = [];

    product.options.forEach((group) => {
      if (group.isRequired) {
        const selected = selectedOptionMap[group.id] || [];
        if (selected.length === 0) {
          errors.push(`يرجى تحديد اختيار من قسم "${group.nameAr}"`);
        }
        if (group.minSelections && selected.length < group.minSelections) {
          errors.push(`يرجى اختيار ${group.minSelections} على الأقل من "${group.nameAr}"`);
        }
      }
    });

    return errors;
  }, [product, selectedOptionMap]);

  const isValid = validationErrors.length === 0;

  // Flatten selected options into snapshot array
  const selectedOptionsSnapshot = useMemo<SelectedOptionSnapshot[]>(() => {
    if (!product) return [];
    const list: SelectedOptionSnapshot[] = [];

    product.options.forEach((group) => {
      const selectedIds = selectedOptionMap[group.id] || [];
      selectedIds.forEach((optId) => {
        const option = group.options.find((o) => o.id === optId);
        if (option) {
          list.push({
            groupId: group.id,
            groupNameAr: group.nameAr,
            optionId: option.id,
            optionNameAr: option.nameAr,
            priceDelta: option.priceDelta,
          });
        }
      });
    });

    return list;
  }, [product, selectedOptionMap]);

  // Calculate live item unit price and total price
  const optionsDeltaSum = useMemo(() => {
    return selectedOptionsSnapshot.reduce((sum, opt) => sum + opt.priceDelta, 0);
  }, [selectedOptionsSnapshot]);

  const unitPrice = (product?.price || 0) + optionsDeltaSum;
  const lineTotal = unitPrice * quantity;

  if (!product) return null;

  const handleAddToCart = () => {
    if (!isValid) return;

    addItem({
      productId: product.id,
      productNameSnapshot: product.nameAr,
      imageUrlSnapshot: product.imageUrl,
      basePrice: product.price,
      quantity,
      selectedOptions: selectedOptionsSnapshot,
      notes,
    });

    toast.success(`تمت إضافة ${product.nameAr} إلى السلة`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[90vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Modal Header Bar with Close Button */}
        <div className="relative flex items-center justify-between px-5 py-3.5 border-b border-stone-200/80 bg-cream-50/70">
          <h2 className="text-base font-bold text-stone-900 truncate">
            تفاصيل الوجبة
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors"
            aria-label="إغلاق النافذة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* Hero Image */}
          <div className="relative w-full h-48 sm:h-56 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200/60">
            {!imageError && product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.nameAr}
                fill
                sizes="(max-width: 640px) 100vw, 500px"
                className="object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 bg-cream-100">
                <UtensilsCrossed className="w-10 h-10 mb-2 text-stone-300" />
                <span className="text-xs">مطعم الزيتونة</span>
              </div>
            )}
            {product.badge && (
              <span className="absolute top-3 right-3 text-xs font-bold px-3 py-1 rounded-full bg-gold-600 text-white shadow-md">
                {product.badge}
              </span>
            )}
          </div>

          {/* Product Title and Price */}
          <div className="border-b border-stone-100 pb-3">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-stone-900 leading-snug">
                {product.nameAr}
              </h1>
              <PriceDisplay amount={product.price} size="lg" />
            </div>
            <p className="text-xs sm:text-sm text-stone-600 mt-2 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Options Groups */}
          {product.options.map((group) => {
            const isSingle = group.selectionType === "SINGLE";
            const currentSelected = selectedOptionMap[group.id] || [];

            return (
              <div key={group.id} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    {group.nameAr}
                    {group.isRequired ? (
                      <span className="text-[10px] text-amber-800 bg-amber-100 font-bold px-1.5 py-0.5 rounded">
                        مطلوب
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-400 font-normal">
                        اختياري
                      </span>
                    )}
                  </span>
                  {group.maxSelections && (
                    <span className="text-[11px] text-stone-400">
                      (حد أقصى {group.maxSelections})
                    </span>
                  )}
                </div>

                {/* Option Choices */}
                <div className="grid grid-cols-1 gap-2">
                  {group.options.map((option) => {
                    const isSelected = currentSelected.includes(option.id);

                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={!option.isAvailable}
                        onClick={() => {
                          if (isSingle) {
                            handleSingleSelect(group.id, option.id);
                          } else {
                            handleMultipleToggle(group, option.id);
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border text-right transition-all",
                          isSelected
                            ? "bg-forest-50/80 border-forest-600 text-forest-950 font-semibold shadow-sm"
                            : "bg-white border-stone-200 hover:border-stone-300 text-stone-800",
                          !option.isAvailable && "opacity-40 cursor-not-allowed bg-stone-50"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "w-5 h-5 rounded-md flex items-center justify-center border transition-colors",
                              isSingle && "rounded-full",
                              isSelected
                                ? "bg-forest-800 border-forest-800 text-white"
                                : "border-stone-300 bg-white"
                            )}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span className="text-xs sm:text-sm">{option.nameAr}</span>
                        </div>

                        <span className="text-xs font-bold text-stone-700">
                          {option.priceDelta > 0
                            ? `+ ${formatCurrency(option.priceDelta)}`
                            : "بدون تكلفة"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Special Instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700 block">
              ملاحظات خاصة للشيف (اختياري)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: بدون بصل، زيادة صوص الطحينة، تسوية زيادة..."
              className="w-full p-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 resize-none"
            />
          </div>

          {/* Validation Error Notices */}
          {validationErrors.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 space-y-1">
              {validationErrors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer: Quantity Selector & Add Button */}
        <div className="p-4 bg-stone-50 border-t border-stone-200/80 flex items-center gap-3">
          {/* Quantity Selector */}
          <div className="flex items-center bg-white border border-stone-200 rounded-xl p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              aria-label="تقليل الكمية"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center text-sm font-bold text-stone-900 tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-600 hover:bg-stone-100 transition-colors"
              aria-label="زيادة الكمية"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add to Cart Submit Button */}
          <button
            type="button"
            disabled={!isValid}
            onClick={handleAddToCart}
            className={cn(
              "flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-between text-white transition-all shadow-soft active:scale-[0.99]",
              isValid
                ? "bg-forest-800 hover:bg-forest-700"
                : "bg-stone-300 cursor-not-allowed text-stone-500 shadow-none"
            )}
          >
            <span>إضافة إلى الطلب</span>
            <span className="tabular-nums font-bold">
              {formatCurrency(lineTotal)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
