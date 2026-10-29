import React from "react";
import { notFound } from "next/navigation";
import { restaurantRepository } from "@/repositories/restaurant-repository";
import { menuRepository } from "@/repositories/menu-repository";
import { MenuView } from "@/components/customer/menu-view";

export const dynamic = "force-dynamic";

interface MenuPageProps {
  params: Promise<{
    restaurantSlug: string;
    tableToken: string;
  }>;
}

export default async function MenuPage({ params }: MenuPageProps) {
  const { restaurantSlug, tableToken } = await params;

  // Resolve restaurant
  const restaurant = await restaurantRepository.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();

  // Resolve table
  const table = await restaurantRepository.getTableByToken(restaurant.slug, tableToken);
  if (!table) notFound();

  // Load categories and products via repository
  const categories = await menuRepository.getCategories(restaurant.slug);
  const allProducts = await menuRepository.getProducts(restaurant.slug);

  return (
    <MenuView
      restaurant={restaurant}
      table={table}
      categories={categories}
      allProducts={allProducts}
      restaurantSlug={restaurantSlug}
      tableToken={tableToken}
    />
  );
}
