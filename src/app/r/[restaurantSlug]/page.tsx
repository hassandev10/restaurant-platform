import React from "react";
import { notFound } from "next/navigation";
import { restaurantRepository } from "@/repositories/restaurant-repository";
import { menuRepository } from "@/repositories/menu-repository";
import { MenuView } from "@/components/customer/menu-view";
import { CustomerPageShell } from "@/components/customer/customer-page-shell";

export const dynamic = "force-dynamic";

interface RestaurantEntryPageProps {
  params: Promise<{
    restaurantSlug: string;
  }>;
}

export default async function RestaurantEntryPage({ params }: RestaurantEntryPageProps) {
  const { restaurantSlug } = await params;

  const restaurant = await restaurantRepository.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) {
    notFound();
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
