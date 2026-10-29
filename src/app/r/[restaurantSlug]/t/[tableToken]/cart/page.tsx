import React from "react";
import { notFound } from "next/navigation";
import { restaurantRepository } from "@/repositories/restaurant-repository";
import { CartView } from "@/components/customer/cart-view";

interface CartPageProps {
  params: Promise<{
    restaurantSlug: string;
    tableToken: string;
  }>;
}

export default async function CartPage({ params }: CartPageProps) {
  const { restaurantSlug, tableToken } = await params;

  const restaurant = await restaurantRepository.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();

  const table = await restaurantRepository.getTableByToken(restaurant.slug, tableToken);
  if (!table) notFound();

  return (
    <CartView
      restaurant={restaurant}
      table={table}
      restaurantSlug={restaurantSlug}
      tableToken={tableToken}
    />
  );
}
