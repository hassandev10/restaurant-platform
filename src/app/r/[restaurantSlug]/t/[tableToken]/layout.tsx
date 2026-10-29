import React from "react";
import Link from "next/link";
import { restaurantRepository } from "@/repositories/restaurant-repository";
import { CartProvider } from "@/context/cart-context";
import { ErrorState } from "@/components/shared/error-state";
import { DemoNotice } from "@/components/shared/demo-notice";
import { ActiveOrderBanner } from "@/components/customer/active-order-banner";
import { QrCode } from "lucide-react";

interface CustomerLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    restaurantSlug: string;
    tableToken: string;
  }>;
}

export default async function CustomerLayout({
  children,
  params,
}: CustomerLayoutProps) {
  const { restaurantSlug, tableToken } = await params;

  // 1. Resolve restaurant
  const restaurant = await restaurantRepository.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) {
    return (
      <main className="min-h-screen bg-cream-100 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full">
          <ErrorState
            title="المطعم غير موجود"
            message={`تعذر العثور على مطعم بالمعرف "${restaurantSlug}". يرجى التأكد من مسح رمز الـ QR الصحيح.`}
            action={
              <Link
                href="/r/demo-restaurant/t/demo-table-token"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-forest-800 text-white text-xs font-bold"
              >
                <QrCode className="w-4 h-4" />
                <span>فتح المنيو التجريبي (مطعم الزيتونة)</span>
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  // 2. Resolve table from backend
  const table = await restaurantRepository.getTableByToken(restaurant.slug, tableToken);
  if (!table) {
    return (
      <main className="min-h-screen bg-cream-100 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full">
          <ErrorState
            title="رمز الـ QR غير صالح أو غير مسجل"
            message={`تعذر العثور على طاولة مسجلة بهذا الرمز "${tableToken}" في ${restaurant.name}. يرجى التأكد من مسح رمز الـ QR الموجود أمامك على الطاولة أو طلب المساعدة من موظف الصالة.`}
            action={
              <div className="flex flex-col sm:flex-row gap-2.5 w-full justify-center">
                <Link
                  href={`/r/${restaurant.slug}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-bold transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                  <span>صفحة مسح الـ QR</span>
                </Link>
                <Link
                  href={`/r/${restaurant.slug}/takeaway`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors"
                >
                  <span>طلب سفري (Take Away)</span>
                </Link>
              </div>
            }
          />
        </div>
      </main>
    );
  }

  // 3. Operational eligibility guard: reject disabled/out-of-service tables
  if (table.status === "OUT_OF_SERVICE" || table.status === "INACTIVE") {
    return (
      <main className="min-h-screen bg-cream-100 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full">
          <ErrorState
            title="الطاولة خارج الخدمة مؤقتاً"
            message={`الطاولة رقم (${table.name}) خارج الخدمة حالياً ولا يمكن قبول طلبات جديدة عليها. يرجى مراجعة موظف الصالة لمساعدتك.`}
            action={
              <div className="flex flex-col sm:flex-row gap-2.5 w-full justify-center">
                <Link
                  href={`/r/${restaurant.slug}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-bold transition-colors"
                >
                  <span>العودة للرئيسية</span>
                </Link>
                <Link
                  href={`/r/${restaurant.slug}/takeaway`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors"
                >
                  <span>طلب سفري (Take Away)</span>
                </Link>
              </div>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <CartProvider restaurantSlug={restaurantSlug} tableToken={tableToken}>
      <div className="min-h-screen bg-cream-100 text-stone-900 flex flex-col font-cairo">
        {/* Top Demo Notification Banner */}
        <DemoNotice variant="banner" />

        {/* Live Active Food Tracking Banner (Always With Customer) */}
        <ActiveOrderBanner restaurantSlug={restaurantSlug} tableToken={tableToken} />
        
        {/* Child Pages (Menu, Cart, Order) */}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </CartProvider>
  );
}
