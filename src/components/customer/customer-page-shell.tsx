"use client";

import React from "react";
import { CartProvider } from "@/context/cart-context";
import { DemoNotice } from "@/components/shared/demo-notice";
import { ActiveOrderBanner } from "@/components/customer/active-order-banner";
import { OrderType } from "@/types/order";

interface CustomerPageShellProps {
  children: React.ReactNode;
  restaurantSlug: string;
  tableToken?: string;
  orderType?: OrderType;
}

export const CustomerPageShell: React.FC<CustomerPageShellProps> = ({
  children,
  restaurantSlug,
  tableToken,
  orderType = "DINE_IN",
}) => {
  return (
    <CartProvider
      restaurantSlug={restaurantSlug}
      tableToken={tableToken}
      orderType={orderType}
    >
      <div className="min-h-screen bg-cream-100 text-stone-900 flex flex-col font-cairo">
        {/* Top Demo Notification Banner */}
        <DemoNotice variant="banner" />

        {/* Live Active Order Food Tracking Banner */}
        <ActiveOrderBanner restaurantSlug={restaurantSlug} tableToken={tableToken} />

        {/* Main Content Area */}
        <div className="flex-1">{children}</div>
      </div>
    </CartProvider>
  );
};
