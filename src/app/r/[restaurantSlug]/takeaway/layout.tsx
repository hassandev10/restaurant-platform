import React from "react";
import Link from "next/link";
import { restaurantRepository } from "@/repositories/restaurant-repository";
import { CartProvider } from "@/context/cart-context";
import { ErrorState } from "@/components/shared/error-state";
import { DemoNotice } from "@/components/shared/demo-notice";
import { ActiveOrderBanner } from "@/components/customer/active-order-banner";

interface TakeawayLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    restaurantSlug: string;
  }>;
}

export default async function TakeawayLayout({
  children,
  params,
}: TakeawayLayoutProps) {
  const { restaurantSlug } = await params;

  // Resolve restaurant
  const restaurant = await restaurantRepository.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) {
    return (
      <main className="min-h-screen bg-cream-100 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full">
          <ErrorState
            title="المطعم غير موجود"
            message={`تعذر العثور على مطعم بالمعرف "${restaurantSlug}".`}
            action={
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-forest-800 text-white text-xs font-bold"
              >
                <span>العودة للرئيسية</span>
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <CartProvider restaurantSlug={restaurantSlug} orderType="TAKEAWAY">
      <div className="min-h-screen bg-cream-100 text-stone-900 flex flex-col font-cairo">
        {/* Top Demo Notification Banner */}
        <DemoNotice variant="banner" />

        {/* Live Active Order Tracking Banner */}
        <ActiveOrderBanner restaurantSlug={restaurantSlug} />

        {/* Child Pages (Takeaway Menu, Cart, Order) */}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </CartProvider>
  );
}
