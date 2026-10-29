import React from "react";
import { notFound } from "next/navigation";
import { restaurantRepository } from "@/repositories/restaurant-repository";
import { CartView } from "@/components/customer/cart-view";
import { CustomerPageShell } from "@/components/customer/customer-page-shell";

interface RestaurantCartPageProps {
  params: Promise<{
    restaurantSlug: string;
  }>;
}

export default async function RestaurantCartPage({ params }: RestaurantCartPageProps) {
  const { restaurantSlug } = await params;

  const restaurant = await restaurantRepository.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) {
    notFound();
  }

  return (
    <CustomerPageShell restaurantSlug={restaurantSlug}>
      <CartView
        restaurant={restaurant}
        restaurantSlug={restaurantSlug}
      />
    </CustomerPageShell>
  );
}
