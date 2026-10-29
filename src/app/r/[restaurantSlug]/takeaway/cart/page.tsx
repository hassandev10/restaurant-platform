import React from "react";
import { notFound } from "next/navigation";
import { restaurantRepository } from "@/repositories/restaurant-repository";
import { CartView } from "@/components/customer/cart-view";

interface TakeawayCartPageProps {
  params: Promise<{
    restaurantSlug: string;
  }>;
}

export default async function TakeawayCartPage({ params }: TakeawayCartPageProps) {
  const { restaurantSlug } = await params;

  const restaurant = await restaurantRepository.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();

  return (
    <CartView
      restaurant={restaurant}
      restaurantSlug={restaurantSlug}
    />
  );
}
