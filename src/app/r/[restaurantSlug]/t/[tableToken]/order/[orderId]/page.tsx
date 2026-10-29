import React from "react";
import { notFound } from "next/navigation";
import { restaurantRepository } from "@/repositories/restaurant-repository";
import { orderRepository } from "@/repositories/order-repository";
import { OrderConfirmationView } from "@/components/customer/order-confirmation-view";

interface OrderTrackingPageProps {
  params: Promise<{
    restaurantSlug: string;
    tableToken: string;
    orderId: string;
  }>;
}

export default async function OrderTrackingPage({ params }: OrderTrackingPageProps) {
  const { restaurantSlug, tableToken, orderId } = await params;

  const restaurant = await restaurantRepository.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();

  const table = await restaurantRepository.getTableByToken(restaurant.slug, tableToken);
  if (!table) notFound();

  // Try to load initial order on server if available
  const initialOrder = await orderRepository.getOrderById(orderId);

  return (
    <OrderConfirmationView
      initialOrder={initialOrder}
      orderId={orderId}
      restaurant={restaurant}
      table={table}
      restaurantSlug={restaurantSlug}
      tableToken={tableToken}
    />
  );
}
