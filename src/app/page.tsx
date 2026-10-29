import React from "react";
import { restaurantRepository } from "@/repositories/restaurant-repository";
import { menuRepository } from "@/repositories/menu-repository";
import { MenuView } from "@/components/customer/menu-view";
import { CustomerPageShell } from "@/components/customer/customer-page-shell";
import { ErrorState } from "@/components/shared/error-state";

export const dynamic = "force-dynamic";

export default async function RootHomePage() {
  const restaurant = await restaurantRepository.getRestaurantBySlug("demo-restaurant");

  if (!restaurant) {
    return (
      <main className="min-h-screen bg-cream-100 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full">
          <ErrorState
            title="المطعم غير متاح حالياً"
            message="تعذر تحميل بيانات المطعم. يرجى التأكد من تشغيل الخادم والمحاولة مرة أخرى."
          />
        </div>
      </main>
    );
  }

  const [categories, allProducts] = await Promise.all([
    menuRepository.getCategories(restaurant.slug),
    menuRepository.getProducts(restaurant.slug),
  ]);

  return (
    <CustomerPageShell restaurantSlug={restaurant.slug}>
      <MenuView
        restaurant={restaurant}
        categories={categories}
        allProducts={allProducts}
        restaurantSlug={restaurant.slug}
      />
    </CustomerPageShell>
  );
}
