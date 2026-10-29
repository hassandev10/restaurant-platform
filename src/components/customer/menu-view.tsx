"use client";

import React, { useState, useMemo } from "react";
import { Restaurant } from "@/types/restaurant";
import { RestaurantTable } from "@/types/table";
import { MenuCategory, Product } from "@/types/menu";
import { RestaurantHeader } from "@/components/customer/restaurant-header";
import { CategoryNavigation } from "@/components/customer/category-navigation";
import { MenuSearch } from "@/components/customer/menu-search";
import { ProductCard } from "@/components/customer/product-card";
import { ProductDetailsModal } from "@/components/customer/product-details-modal";
import { CartFloatingButton } from "@/components/customer/cart-floating-button";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchX } from "lucide-react";

interface MenuViewProps {
  restaurant: Restaurant;
  table?: RestaurantTable | null;
  categories: MenuCategory[];
  allProducts: Product[];
  restaurantSlug: string;
  tableToken?: string;
}

export const MenuView: React.FC<MenuViewProps> = ({
  restaurant,
  table,
  categories,
  allProducts,
  restaurantSlug,
  tableToken,
}) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Compute product counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allProducts.length,
    };
    categories.forEach((cat) => {
      if (cat.id !== "all") {
        counts[cat.id] = allProducts.filter((p) => p.categoryId === cat.id).length;
      }
    });
    return counts;
  }, [allProducts, categories]);

  // Filter products by search query and active category
  const filteredProducts = useMemo(() => {
    let list = allProducts;

    // 1. Filter by category
    if (activeCategoryId !== "all") {
      list = list.filter((p) => p.categoryId === activeCategoryId);
    }

    // 2. Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((p) => {
        const matchAr = p.nameAr.toLowerCase().includes(q);
        const matchEn = p.nameEn?.toLowerCase().includes(q) ?? false;
        const matchDesc = p.description.toLowerCase().includes(q);
        return matchAr || matchEn || matchDesc;
      });
    }

    return list;
  }, [allProducts, activeCategoryId, searchQuery]);

  return (
    <div className="pb-28">
      {/* 1. Header */}
      <RestaurantHeader
        restaurant={restaurant}
        table={table}
        restaurantSlug={restaurantSlug}
        tableToken={tableToken}
      />

      {/* 2. Category Navigation Bar */}
      <CategoryNavigation
        categories={categories}
        activeCategoryId={activeCategoryId}
        onSelectCategory={setActiveCategoryId}
        categoryCounts={categoryCounts}
      />

      {/* 3. Search Bar */}
      <MenuSearch
        value={searchQuery}
        onChange={setSearchQuery}
        resultCount={filteredProducts.length}
      />

      {/* 4. Products Grid / List */}
      <main className="max-w-3xl mx-auto px-4 mt-2">
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={setSelectedProduct}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="لم نتمكن من العثور على أطباق مطابقة"
            description={`لا توجد أصناف تطابق "${searchQuery}" في هذا القسم. جرب البحث بكلمات أخرى أو اختر قسما آخر.`}
            icon={SearchX}
            action={
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategoryId("all");
                }}
                className="px-4 py-2 rounded-xl bg-forest-800 text-white text-xs font-bold hover:bg-forest-900 transition-colors"
              >
                عرض كل الأصناف
              </button>
            }
          />
        )}
      </main>

      {/* 5. Product Customize & Add Dialog */}
      <ProductDetailsModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      {/* 6. Sticky Floating Cart Button */}
      <CartFloatingButton
        restaurantSlug={restaurantSlug}
        tableToken={tableToken}
      />
    </div>
  );
};
