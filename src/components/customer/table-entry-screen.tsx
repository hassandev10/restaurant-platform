"use client";

import React from "react";
import { Restaurant } from "@/types/restaurant";
import { QrWelcomeScreen } from "./qr-welcome-screen";

interface TableEntryScreenProps {
  restaurant: Restaurant;
  initialError?: string;
  redirectToMenuOnSuccess?: boolean;
  onTableValidated?: (table: unknown) => void;
}

/**
 * TableEntryScreen has been modernized into QrWelcomeScreen.
 * Customers identify their table via scanning the table's physical QR code,
 * completely eliminating manual table-number entry and guesswork.
 */
export const TableEntryScreen: React.FC<TableEntryScreenProps> = ({
  restaurant,
}) => {
  return <QrWelcomeScreen restaurant={restaurant} />;
};

export { QrWelcomeScreen };
