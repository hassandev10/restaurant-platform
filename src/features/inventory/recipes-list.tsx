"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/formatters";
import { inventoryService } from "@/services/inventory-service";
import { menuService } from "@/services/menu-service";
import { MenuItemRecipe } from "@/types/inventory";
import { Product } from "@/types/menu";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { ContractUnavailableBanner } from "@/components/shared/contract-unavailable-banner";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import {
  AlertTriangle,
  ChefHat,
  ChevronLeft,
  DollarSign,
  Layers,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

interface RecipeListItem {
  product: Product;
  recipe?: MenuItemRecipe;
  isConfigured: boolean;
  ingredientCount: number;
  estimatedCost: number;
  marginPercent?: number;
}

export function RecipesList() {
  const [items, setItems] = useState<RecipeListItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; nameAr: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isContractLive, setIsContractLive] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [configFilter, setConfigFilter] = useState<"all" | "configured" | "missing">("all");

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [menuRes, recipes] = await Promise.all([
        menuService.getMenu(),
        inventoryService.getRecipes(),
      ]);

      const liveCheck = await inventoryService.checkContractStatus("/api/v1/admin/inventory/recipes");
      setIsContractLive(liveCheck);

      const categoryMap = new Map<string, string>();
      menuRes.categories.forEach((c) => categoryMap.set(c.id, c.nameAr));
      setCategories(menuRes.categories.map((c) => ({ id: c.id, nameAr: c.nameAr })));

      const recipeMap = new Map<string, MenuItemRecipe>();
      recipes.forEach((r) => recipeMap.set(r.menuItemId, r));

      const combined: RecipeListItem[] = menuRes.products.map((prod) => {
        const recipe = recipeMap.get(prod.id);
        const isConfigured = !!recipe && recipe.ingredients.length > 0;
        const estimatedCost = recipe?.totalEstimatedCost || 0;
        let marginPercent: number | undefined;

        if (prod.price > 0 && estimatedCost > 0) {
          marginPercent = Math.max(0, Math.round(((prod.price - estimatedCost) / prod.price) * 100));
        }

        return {
          product: prod,
          recipe,
          isConfigured,
          ingredientCount: recipe?.ingredients.length || 0,
          estimatedCost,
          marginPercent,
        };
      });

      setItems(combined);
    } catch (err: any) {
      console.error("Failed to load recipes data:", err);
      setError(err?.message || "حدث خطأ أثناء تحميل بيانات وصفات الأصناف");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered
  const filteredItems = items.filter((item) => {
    if (selectedCategory !== "all" && item.product.categoryId !== selectedCategory) {
      return false;
    }
    if (configFilter === "configured" && !item.isConfigured) return false;
    if (configFilter === "missing" && item.isConfigured) return false;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchAr = item.product.nameAr.toLowerCase().includes(q);
      const matchEn = item.product.nameEn?.toLowerCase().includes(q) || false;
      return matchAr || matchEn;
    }
    return true;
  });

  const configuredCount = items.filter((i) => i.isConfigured).length;
  const missingCount = items.length - configuredCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">وصفات قائمة الطعام (Recipes / BOM)</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              {items.length} طبق
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            ربط أصناف قائمة الطعام بمكونات وخامات المخزون لحساب تكلفة الطبق والخصم الآلي عند تحضير الطلبات
          </p>
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث
        </button>
      </div>

      {/* Contract Banner */}
      {!isContractLive && (
        <ContractUnavailableBanner
          title="عقود ومواصفات وصفات قائمة الطعام وجداول المكونات (BOM)"
          moduleNameAr="نظام وصفات الأطباق وجداول المكونات"
          contracts={[
            {
              method: "GET",
              endpoint: "/api/v1/admin/inventory/recipes",
              descriptionAr: "استرجاع قائمة وصفات أطباق المنيو ومكوناتها المخزنية",
              status: "PENDING_BACKEND",
            },
            {
              method: "GET",
              endpoint: "/api/v1/admin/inventory/recipes/:menuItemId",
              descriptionAr: "استرجاع وصفة طبق منيو محدد",
              status: "PENDING_BACKEND",
            },
            {
              method: "PUT",
              endpoint: "/api/v1/admin/inventory/recipes/:menuItemId",
              descriptionAr: "حفظ وتحديث مكونات وصفة طبق المنيو",
              status: "PENDING_BACKEND",
            },
          ]}
          alternativeActionDescription="تتم إدارة الوصفات واحتساب التكاليف وهوامش الربح محلياً وفق مواصفات العقد البرمجي بانتظار تفعيلها في Go Backend."
        />
      )}

      {/* Sub Navigation */}
      <InventoryNav />

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">إجمالي أطباق المنيو</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{items.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">أطباق مهيأة بالوصفة والمكونات</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5">
              {configuredCount}{" "}
              <span className="text-xs font-normal text-gray-500">
                ({items.length > 0 ? Math.round((configuredCount / items.length) * 100) : 0}%)
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">أطباق بدون وصفة مكونات</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{missingCount}</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث باسم الطبق..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-56">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="all">كل التصنيفات ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setConfigFilter("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                configFilter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setConfigFilter("configured")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                configFilter === "configured" ? "bg-white text-emerald-800 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              مهيأة ({configuredCount})
            </button>
            <button
              onClick={() => setConfigFilter("missing")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                configFilter === "missing" ? "bg-white text-amber-800 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              غير مهيأة ({missingCount})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <LoadingState message="جاري تحميل وصفات الأطباق والمكونات..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">لا توجد أطباق مطابقة للبحث</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            جرّب تغيير كلمات البحث أو إعادة ضبط خيارات التصفية للعثور على الأطباق المطلوبة
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold text-gray-500">
                  <th className="py-3 px-4">صنف قائمة الطعام (الطبق)</th>
                  <th className="py-3 px-4">سعر البيع</th>
                  <th className="py-3 px-4">تكلفة المكونات التقديرية</th>
                  <th className="py-3 px-4">هامش الربح الإجمالي</th>
                  <th className="py-3 px-4">عدد المكونات</th>
                  <th className="py-3 px-4">حالة الوصفة</th>
                  <th className="py-3 px-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredItems.map((item) => (
                  <tr key={item.product.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Item */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {item.product.imageUrl ? (
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.nameAr}
                            className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 text-gray-400">
                            <UtensilsCrossed className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-gray-900">{item.product.nameAr}</div>
                          {item.product.nameEn && (
                            <div className="text-xs text-gray-500 font-sans">{item.product.nameEn}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-3 px-4 font-bold text-gray-900">
                      {formatCurrency(item.product.price)}
                    </td>

                    {/* Cost */}
                    <td className="py-3 px-4">
                      {item.isConfigured ? (
                        <span className="font-semibold text-gray-800">
                          {formatCurrency(item.estimatedCost)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">غير محددة</span>
                      )}
                    </td>

                    {/* Margin */}
                    <td className="py-3 px-4">
                      {item.marginPercent !== undefined ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span>{item.marginPercent}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* Ingredients Count */}
                    <td className="py-3 px-4">
                      {item.ingredientCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700">
                          <Layers className="w-3.5 h-3.5 text-gray-400" />
                          {item.ingredientCount} مكونات
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">لا يوجد</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {item.isConfigured ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          مهيأة بالكامل
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          تتطلب إعداد الوصفة
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-center">
                      <Link
                        href={`/inventory/recipes/${item.product.id}`}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          item.isConfigured
                            ? "bg-gray-100 text-gray-800 hover:bg-gray-200"
                            : "bg-primary text-white hover:bg-primary-hover shadow-sm"
                        }`}
                      >
                        {item.isConfigured ? "تعديل المكونات" : "إعداد الوصفة"}
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
