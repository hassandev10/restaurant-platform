"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { CartItem, SelectedOptionSnapshot } from "@/types/cart";
import { OrderType } from "@/types/order";

function getCartStorageKey(restaurantSlug?: string, orderType: OrderType = "DINE_IN", tableToken?: string): string {
  const rest = restaurantSlug || "default";
  if (orderType === "TAKEAWAY") {
    return `smart_restaurant_cart_${rest}_takeaway_v1`;
  }
  return `smart_restaurant_cart_${rest}_dine_in_${tableToken || "unassigned"}_v1`;
}

interface AddItemParams {
  productId: string;
  productNameSnapshot: string;
  imageUrlSnapshot: string;
  basePrice: number;
  quantity: number;
  selectedOptions: SelectedOptionSnapshot[];
  notes?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: AddItemParams) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItemsCount: number;
  subtotal: number;
  total: number;
  isHydrated: boolean;
  orderType: OrderType;
  isTakeaway: boolean;
  isDineIn: boolean;
  restaurantSlug?: string;
  tableToken?: string;
  hasValidTable: boolean;
  canOrder: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function generateItemSignature(item: AddItemParams): string {
  const optionsKey = [...item.selectedOptions]
    .sort((a, b) => a.optionId.localeCompare(b.optionId))
    .map((o) => `${o.groupId}:${o.optionId}`)
    .join("|");
  return `${item.productId}__${optionsKey}__${(item.notes || "").trim()}`;
}

export const CartProvider: React.FC<{
  children: React.ReactNode;
  restaurantSlug?: string;
  orderType?: OrderType;
  tableToken?: string;
}> = ({ children, restaurantSlug, orderType = "DINE_IN", tableToken }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const isTakeaway = orderType === "TAKEAWAY";
  const isDineIn = orderType === "DINE_IN";
  const hasValidTable = Boolean(tableToken && tableToken.trim().length > 0);
  const canOrder = isTakeaway || hasValidTable;

  const storageKey = useMemo(
    () => getCartStorageKey(restaurantSlug, orderType, tableToken),
    [restaurantSlug, orderType, tableToken]
  );

  // Hydrate from isolated localStorage key
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        } else {
          setItems([]);
        }
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setIsHydrated(true);
    }
  }, [storageKey]);

  // Persist to isolated localStorage key
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Ignore localStorage write error
    }
  }, [items, isHydrated, storageKey]);

  const addItem = useCallback((params: AddItemParams) => {
    setItems((prev) => {
      const signature = generateItemSignature(params);
      const existingIndex = prev.findIndex((i) => i.id === signature);

      const optionsDelta = params.selectedOptions.reduce((acc, opt) => acc + opt.priceDelta, 0);
      const unitPrice = params.basePrice + optionsDelta;

      if (existingIndex !== -1) {
        const existing = prev[existingIndex];
        const newQty = existing.quantity + params.quantity;
        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          lineTotal: unitPrice * newQty,
        };
        return updated;
      }

      const newItem: CartItem = {
        id: signature,
        productId: params.productId,
        productNameSnapshot: params.productNameSnapshot,
        imageUrlSnapshot: params.imageUrlSnapshot,
        basePrice: params.basePrice,
        quantity: params.quantity,
        selectedOptions: params.selectedOptions,
        notes: params.notes,
        lineTotal: unitPrice * params.quantity,
      };

      return [...prev, newItem];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const optionsDelta = item.selectedOptions.reduce((acc, opt) => acc + opt.priceDelta, 0);
        const unitPrice = item.basePrice + optionsDelta;
        return {
          ...item,
          quantity,
          lineTotal: unitPrice * quantity,
        };
      })
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const { subtotal, total, totalItemsCount } = useMemo(() => {
    const sum = items.reduce((acc, item) => acc + item.lineTotal, 0);
    const count = items.reduce((acc, item) => acc + item.quantity, 0);
    return {
      subtotal: sum,
      total: sum,
      totalItemsCount: count,
    };
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItemsCount,
        subtotal,
        total,
        isHydrated,
        orderType,
        isTakeaway,
        isDineIn,
        restaurantSlug,
        tableToken,
        hasValidTable,
        canOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
