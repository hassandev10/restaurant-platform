"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Restaurant } from "@/types/restaurant";
import { TableEntryScreen } from "@/components/customer/table-entry-screen";
import {
  Utensils,
  ShoppingBag,
  Store,
  ArrowLeft,
  ChevronLeft,
} from "lucide-react";

interface OrderTypeSelectionScreenProps {
  restaurant: Restaurant;
  initialMode?: "selection" | "table-entry";
}

export const OrderTypeSelectionScreen: React.FC<OrderTypeSelectionScreenProps> = ({
  restaurant,
  initialMode = "selection",
}) => {
  const router = useRouter();
  const [mode, setMode] = useState<"selection" | "table-entry">(initialMode);

  // If in table-entry mode, render TableEntryScreen with a back button to selection mode
  if (mode === "table-entry") {
    return (
      <div className="relative">
        <div className="fixed top-4 right-4 z-50">
          <button
            type="button"
            onClick={() => setMode("selection")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-sm border border-stone-200 text-stone-700 hover:text-stone-900 text-xs font-bold shadow-sm transition-all"
          >
            <ChevronLeft className="w-4 h-4 rotate-180" />
            <span>تغيير نوع الطلب</span>
          </button>
        </div>
        <TableEntryScreen restaurant={restaurant} redirectToMenuOnSuccess={true} />
      </div>
    );
  }

  const handleSelectDineIn = () => {
    setMode("table-entry");
  };

  const handleSelectTakeaway = () => {
    // Navigate directly to the takeaway menu route
    router.push(`/r/${restaurant.slug}/takeaway`);
  };

  return (
    <main
      className="min-h-screen bg-gradient-to-b from-cream-100 via-cream-50 to-white flex flex-col justify-center items-center p-4 sm:p-6"
      dir="rtl"
    >
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-forest-900 text-cream-100 shadow-float mb-1 border border-forest-800 overflow-hidden relative">
            {restaurant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={restaurant.logoUrl}
                alt={restaurant.name}
                className="w-16 h-16 rounded-3xl object-cover"
              />
            ) : (
              <Utensils className="w-8 h-8 text-cream-200" />
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-forest-100 text-forest-800 border border-forest-200">
            <Store className="w-3.5 h-3.5" />
            <span>{restaurant.name}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            أهلاً بيك في {restaurant.name}
          </h1>

          <p className="text-xs sm:text-sm text-stone-600 max-w-xs mx-auto leading-relaxed">
            اختر كيف تود تناول وجبتك اليوم لتصفح قائمة الطعام وإرسال طلبك.
          </p>
        </div>

        {/* Two Clear Selection Cards */}
        <div className="space-y-4">
          {/* Card A: Dine In — داخل المطعم */}
          <div
            onClick={handleSelectDineIn}
            className="group relative bg-white rounded-3xl border-2 border-stone-200/90 hover:border-forest-700 p-4 sm:p-5 shadow-card hover:shadow-float transition-all duration-300 cursor-pointer overflow-hidden flex flex-col gap-3.5 active:scale-[0.99]"
          >
            <div className="relative h-36 w-full rounded-2xl overflow-hidden bg-stone-100">
              <Image
                src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=80"
                alt="داخل المطعم"
                fill
                sizes="(max-width: 640px) 100vw, 450px"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent" />

              <div className="absolute bottom-3 right-3 text-white">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-forest-800/90 text-cream-50 border border-forest-600/50 backdrop-blur-xs">
                  <Utensils className="w-3.5 h-3.5 text-cream-200" />
                  <span>خدمة الصالة</span>
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg font-extrabold text-stone-900 group-hover:text-forest-900 transition-colors">
                  داخل المطعم
                </h2>
                <p className="text-xs text-stone-500 leading-relaxed">
                  هتطلب أكلك وتستمتع بوجبتك على طاولتك
                </p>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-forest-800 group-hover:bg-forest-900 text-white text-xs font-extrabold shadow-sm flex-shrink-0 transition-colors"
              >
                <span>اختيار الطاولة</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card B: Takeaway — تيك أواي */}
          <div
            onClick={handleSelectTakeaway}
            className="group relative bg-white rounded-3xl border-2 border-stone-200/90 hover:border-amber-600 p-4 sm:p-5 shadow-card hover:shadow-float transition-all duration-300 cursor-pointer overflow-hidden flex flex-col gap-3.5 active:scale-[0.99]"
          >
            <div className="relative h-36 w-full rounded-2xl overflow-hidden bg-stone-100">
              <Image
                src="https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=700&q=80"
                alt="Take Away"
                fill
                sizes="(max-width: 640px) 100vw, 450px"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent" />

              <div className="absolute bottom-3 right-3 text-white">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-700/90 text-white border border-amber-500/50 backdrop-blur-xs">
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-200" />
                  <span>استلام سفري</span>
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg font-extrabold text-stone-900 group-hover:text-amber-900 transition-colors">
                  Take Away
                </h2>
                <p className="text-xs text-stone-500 leading-relaxed">
                  اطلب أكلك واستلمه من المطعم
                </p>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-700 group-hover:bg-amber-800 text-white text-xs font-extrabold shadow-sm flex-shrink-0 transition-colors"
              >
                <span>تصفح المنيو</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center text-xs text-stone-400 space-y-1">
          <p>الدفع عند الكاشير داخل المطعم • أسعار بالجنيه المصري (ج.م)</p>
          <p className="font-mono text-[11px]">
            Smart Restaurant Dining & Takeaway Platform
          </p>
        </div>
      </div>
    </main>
  );
};
