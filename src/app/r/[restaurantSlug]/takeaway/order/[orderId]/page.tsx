import React from "react";
import { notFound } from "next/navigation";
import { restaurantRepository } from "@/repositories/restaurant-repository";
import { orderRepository } from "@/repositories/order-repository";
import { OrderConfirmationView } from "@/components/customer/order-confirmation-view";

interface TakeawayOrderPageProps {
  params: Promise<{
    restaurantSlug: string;
    orderId: string;
  }>;
}

export default async function TakeawayOrderPage({ params }: TakeawayOrderPageProps) {
  const { restaurantSlug, orderId } = await params;

  const restaurant = await restaurantRepository.getRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();

  const order = await orderRepository.getOrderById(orderId);

  return (
    <OrderConfirmationView
      initialOrder={order}
      orderId={orderId}
      restaurant={restaurant}
      restaurantSlug={restaurantSlug}
      orderType="TAKEAWAY"
    />
  );
}
