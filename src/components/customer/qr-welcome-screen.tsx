"use client";

import React from "react";
import Link from "next/link";
import { Restaurant } from "@/types/restaurant";
import {
  Utensils,
  QrCode,
  Camera,
  Store,
  ShoppingBag,
  HelpCircle,
  ArrowLeft,
} from "lucide-react";

interface QrWelcomeScreenProps {
  restaurant: Restaurant;
}

export const QrWelcomeScreen: React.FC<QrWelcomeScreenProps> = ({
  restaurant,
}) => {
  return (
    <main
      className="min-h-screen bg-gradient-to-b from-cream-100 via-cream-50 to-white flex flex-col justify-center items-center p-4 sm:p-6"
      dir="rtl"
    >
      <div className="max-w-md w-full space-y-5">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-forest-900 text-cream-100 shadow-float mb-1 border border-forest-800 overflow-hidden relative mx-auto">
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
            امسح QR Code الموجود على الترابيزة عشان تتصفح المنيو وتطلب بسهولة.
          </p>
        </div>

        {/* QR Scanning Instruction Card */}
        <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-7 shadow-card space-y-5 text-center relative overflow-hidden">
          {/* Subtle decorative background gradient */}
          <div className="absolute -top-16 -right-16 w-32 h-32 bg-forest-50 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-amber-50 rounded-full blur-2xl pointer-events-none" />

          {/* QR Viewfinder Graphic */}
          <div className="relative mx-auto w-36 h-36 flex items-center justify-center">
            {/* Viewfinder Corner Accents */}
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-forest-800 rounded-tr-xl" />
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-forest-800 rounded-tl-xl" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-forest-800 rounded-br-xl" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-forest-800 rounded-bl-xl" />

            {/* Inner QR Visual */}
            <div className="w-28 h-28 rounded-2xl bg-cream-100 flex flex-col items-center justify-center p-3 border border-stone-200/60 shadow-inner group">
              <QrCode className="w-16 h-16 text-forest-900 transition-transform duration-300 group-hover:scale-105" />
            </div>

            {/* Scanning line animation element */}
            <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-forest-600 to-transparent opacity-75" />
          </div>

          {/* Primary Instruction */}
          <div className="space-y-1.5 pt-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-forest-800 bg-forest-50 px-3 py-1 rounded-full border border-forest-100">
              <Camera className="w-3.5 h-3.5" />
              <span>باستخدام كاميرا الموبايل</span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-snug">
              وجّه كاميرا موبايلك إلى QR Code الموجود على الترابيزة
            </h2>

            <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
              ستظهر لك نافذة لفتح قائمة الطعام الخاصة بطاولتك فوراً وإرسال طلبك مباشرة للمطبخ دون انتظار.
            </p>
          </div>

          {/* Secondary Assistance */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-center gap-1.5 text-xs text-stone-500">
            <HelpCircle className="w-4 h-4 text-stone-400 flex-shrink-0" />
            <span>مش لاقي الكود؟ اطلب المساعدة من موظف الصالة.</span>
          </div>
        </div>

        {/* Separated Takeaway Option */}
        <div className="bg-white rounded-3xl border border-stone-200/90 p-4 sm:p-5 shadow-xs transition-all hover:border-amber-400 hover:shadow-card group">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center flex-shrink-0 border border-amber-200/60">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="text-right">
                <div className="text-xs text-stone-400 font-medium">مش جالس في الصالة؟</div>
                <div className="text-sm font-extrabold text-stone-900 group-hover:text-amber-900 transition-colors">
                  طلب سفري • Take Away
                </div>
              </div>
            </div>

            <Link
              href={`/r/${restaurant.slug}/takeaway`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-extrabold shadow-sm transition-all flex-shrink-0 active:scale-95"
            >
              <span>تصفح المنيو</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center text-xs text-stone-400 space-y-1 pt-1">
          <p>الدفع عند الكاشير داخل المطعم • أسعار بالجنيه المصري (ج.م)</p>
          <p className="font-mono text-[11px] text-stone-400">
            Smart Restaurant QR Dining Platform
          </p>
        </div>
      </div>
    </main>
  );
};
