import React from "react";
import { notFound } from "next/navigation";
import { restaurantRepository } from "@/repositories/restaurant-repository";
import { menuRepository } from "@/repositories/menu-repository";
import { MenuView } from "@/components/customer/menu-view";

export const dynamic = "force-dynamic";

interface TakeawayMenuPageProps {
  params: Promise<{
    restaurantSlug: string;
  }>;
}

export default async function TakeawayMenuPage({ params }: TakeawayMenuPageProps) {
  const { restaurantSlug } = await params;

  // Resolve restaurant
  const restaurant = await restaurantRepository.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();

  // Load categories and products via repository
  const categories = await menuRepository.getCategories(restaurant.slug);
  const allProducts = await menuRepository.getProducts(restaurant.slug);

  return (
    <MenuView
      restaurant={restaurant}
      categories={categories}
      allProducts={allProducts}
      restaurantSlug={restaurantSlug}
    />
  );
}
