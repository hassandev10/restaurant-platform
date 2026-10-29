"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, formatUnit } from "@/lib/formatters";
import { inventoryService } from "@/services/inventory-service";
import { menuService } from "@/services/menu-service";
import { InventoryBaseUnit, InventoryItem, MenuItemRecipe, RecipeIngredient } from "@/types/inventory";
import { Product } from "@/types/menu";
import { ContractUnavailableBanner } from "@/components/shared/contract-unavailable-banner";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChefHat,
  DollarSign,
  Info,
  Package,
  Plus,
  Save,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

interface RecipeEditorProps {
  menuItemId: string;
}

interface EditableIngredient {
  itemId: string;
  quantity: number;
  unit: InventoryBaseUnit;
}

export function RecipeEditor({ menuItemId }: RecipeEditorProps) {
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [ingredients, setIngredients] = useState<EditableIngredient[]>([]);
  const [notes, setNotes] = useState("");
  const [isContractLive, setIsContractLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Portions Simulator state
  const [simulatedPortions, setSimulatedPortions] = useState<number>(10);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [menuRes, allInvItems, recipe] = await Promise.all([
          menuService.getMenu(),
          inventoryService.getItems(),
          inventoryService.getRecipe(menuItemId),
        ]);

        const prod = menuRes.products.find((p) => p.id === menuItemId);
        if (!prod) {
          throw new Error("صنف قائمة الطعام المطلوب غير موجود في النظام");
        }
        setProduct(prod);
        setInventoryItems(allInvItems);

        if (recipe && recipe.ingredients.length > 0) {
          setIngredients(
            recipe.ingredients.map((ing) => ({
              itemId: ing.itemId,
              quantity: ing.quantity,
              unit: ing.unit,
            }))
          );
          setNotes(recipe.notes || "");
        } else {
          // Default empty or 1 placeholder row
          setIngredients([]);
        }

        const liveCheck = await inventoryService.checkContractStatus(`/api/v1/admin/inventory/recipes/${menuItemId}`);
        setIsContractLive(liveCheck);
      } catch (err: any) {
        console.error("Failed to load recipe editor data:", err);
        setError(err?.message || "فشل تحميل بيانات الوصفة والمكونات");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [menuItemId]);

  const addIngredientRow = () => {
    // Pick first unused inventory item if possible
    const usedIds = new Set(ingredients.map((i) => i.itemId));
    const available = inventoryItems.find((i) => !usedIds.has(i.id)) || inventoryItems[0];
    if (!available) {
      toast.error("لا توجد أصناف في المخزون لإضافتها");
      return;
    }

    setIngredients([
      ...ingredients,
      {
        itemId: available.id,
        quantity: 0.1,
        unit: available.baseUnit,
      },
    ]);
  };

  const removeIngredientRow = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, newItemId: string) => {
    const item = inventoryItems.find((i) => i.id === newItemId);
    if (!item) return;

    const next = [...ingredients];
    next[index] = {
      ...next[index],
      itemId: newItemId,
      unit: item.baseUnit,
    };
    setIngredients(next);
  };

  const handleQtyChange = (index: number, val: number) => {
    const next = [...ingredients];
    next[index].quantity = Math.max(0.001, Number(val));
    setIngredients(next);
  };

  // Calculations for 1 portion
  const calculatedIngredients = ingredients.map((ing) => {
    const invItem = inventoryItems.find((i) => i.id === ing.itemId);
    const unitCost = invItem?.costPerBaseUnit || 0;
    const itemCost = ing.quantity * unitCost;
    return {
      ...ing,
      invItem,
      unitCost,
      itemCost,
    };
  });

  const totalCostPerPortion = calculatedIngredients.reduce((sum, item) => sum + item.itemCost, 0);
  const dishPrice = product?.price || 0;
  const grossProfitPerPortion = Math.max(0, dishPrice - totalCostPerPortion);
  const marginPercentage = dishPrice > 0 ? Math.round((grossProfitPerPortion / dishPrice) * 100) : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (ingredients.length === 0) {
      toast.error("يرجى إضافة مكون واحد على الأقل للوصفة");
      return;
    }

    // Check duplicates
    const itemIds = ingredients.map((i) => i.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      toast.error("يوجد تكرار في بعض مكونات الوصفة، يرجى دمج الكميات لنفس المكون");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await inventoryService.saveRecipe(menuItemId, {
        menuItemId,
        ingredients: ingredients.map((i) => ({
          itemId: i.itemId,
          quantity: i.quantity,
          unit: i.unit,
        })),
        notes: notes.trim(),
      });

      if (res.isContractLive) {
        toast.success("تم حفظ وتحديث وصفة الطبق بنجاح في الخادم");
      } else {
        toast.info("تم حفظ مسودة الوصفة محلياً (واجهة برمجية معلقة في Go API)");
      }
      router.push("/inventory/recipes");
    } catch (err: any) {
      toast.error(err?.message || "فشل حفظ وصفة الطبق");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="جاري تجهيز محرر وصفة الطبق والمكونات..." />;
  }

  if (error || !product) {
    return <ErrorState message={error || "الطبق غير موجود"} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/inventory/recipes"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          العودة لقائمة الوصفات
        </Link>
      </div>

      {/* Contract Banner */}
      {!isContractLive && (
        <ContractUnavailableBanner
          title="عقود ومواصفات حفظ وتحديث مكونات الوصفة (Recipe BOM Contract)"
          moduleNameAr="خدمة حفظ وتحديث مكونات الوصفة"
          contracts={[
            {
              method: "PUT",
              endpoint: `/api/v1/admin/inventory/recipes/${menuItemId}`,
              descriptionAr: "حفظ مكونات وصفة طبق قائمة الطعام واحتساب الاستهلاك",
              status: "PENDING_BACKEND",
              samplePayload: JSON.stringify(
                {
                  menuItemId,
                  ingredients: ingredients.slice(0, 2),
                  notes: notes || undefined,
                },
                null,
                2
              ),
            },
          ]}
          alternativeActionDescription="تُحفظ مسودة الوصفة محلياً وفق مواصفات العقد البرمجي بانتظار تفعيلها في Go Backend."
        />
      )}

      {/* Dish Summary Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.nameAr}
                className="w-16 h-16 rounded-xl object-cover border border-gray-200 shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                <UtensilsCrossed className="w-8 h-8" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{product.nameAr}</h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                  {product.nameEn || "طبق منيو"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 max-w-xl">{product.description || "لا يوجد وصف مدخل"}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 self-stretch md:self-auto justify-between border-t md:border-t-0 pt-3 md:pt-0 border-gray-100">
            <div>
              <p className="text-xs text-gray-500 font-medium">سعر البيع بالمنيو</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(dishPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">تكلفة المكونات التقديرية</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(totalCostPerPortion)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">هامش الربح</p>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold text-emerald-700">{marginPercentage}%</span>
                <span className="text-xs text-gray-500">({formatCurrency(grossProfitPerPortion)})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Ingredients Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-primary" />
                مكونات وخامات الوجبة الواحدة (Portion BOM)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                حدد الكميات المعيارية المستهلكة من كل خامة لتحضير وجبة واحدة من هذا الصنف
              </p>
            </div>

            <button
              type="button"
              onClick={addIngredientRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              إضافة مكوّن جديد
            </button>
          </div>

          {ingredients.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">لم يتم تحديد مكونات بعد لهذا الطبق</p>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                اضغط على زر الإضافة لاختيار المواد الخام اللازمة من المخزون
              </p>
              <button
                type="button"
                onClick={addIngredientRow}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                إضافة مكوّن
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 border-b border-gray-200">
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">مكوّن المخزون (خامة / مادة أولية)</th>
                    <th className="py-2.5 px-4 w-36">الكمية للوجبة الواحدة</th>
                    <th className="py-2.5 px-4 w-28">وحدة القياس</th>
                    <th className="py-2.5 px-4 w-32">تكلفة الوحدة</th>
                    <th className="py-2.5 px-4 w-36">التكلفة للوجبة</th>
                    <th className="py-2.5 px-4 w-16 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {calculatedIngredients.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-center text-xs text-gray-400 font-mono">{idx + 1}</td>

                      {/* Select Item */}
                      <td className="py-3 px-4">
                        <select
                          value={row.itemId}
                          onChange={(e) => handleItemChange(idx, e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                        >
                          {inventoryItems.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.nameAr} ({inv.sku}) - رصيد: {inv.currentStock} {formatUnit(inv.baseUnit)}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={row.quantity}
                          onChange={(e) => handleQtyChange(idx, parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-left"
                        />
                      </td>

                      {/* Unit */}
                      <td className="py-3 px-4 text-xs font-semibold text-gray-700">
                        {formatUnit(row.unit)}
                      </td>

                      {/* Unit Cost */}
                      <td className="py-3 px-4 text-xs font-mono text-gray-600">
                        {formatCurrency(row.unitCost)} / {formatUnit(row.unit)}
                      </td>

                      {/* Item Cost */}
                      <td className="py-3 px-4 text-xs font-bold text-gray-900 font-mono">
                        {formatCurrency(row.itemCost)}
                      </td>

                      {/* Remove */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => removeIngredientRow(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/75 border-t border-gray-200 font-bold text-sm">
                    <td colSpan={5} className="py-3 px-4 text-left">
                      إجمالي تكلفة المكونات للوجبة الواحدة:
                    </td>
                    <td className="py-3 px-4 font-mono text-primary text-base">
                      {formatCurrency(totalCostPerPortion)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Notes */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              ملاحظات التحضير وطريقة التجهيز (اختياري)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: التتبيلة تتطلب نقع الدجاج لمدة ساعتين قبل الشواء..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {/* Portions Simulator Card */}
        <div className="bg-gradient-to-br from-gray-50 to-emerald-50/40 rounded-xl border border-emerald-200/60 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">محاكي استهلاك المكونات (Portions Demand Simulator)</h3>
                <p className="text-xs text-gray-500">
                  اختبر كميات الخامات المطلوبة وتحقق من كفاية الرصيد الحالي بالمستودع لعدد وجبات محدد
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-gray-700 whitespace-nowrap">عدد الوجبات المستهدفة:</label>
              <input
                type="number"
                min="1"
                max="1000"
                value={simulatedPortions}
                onChange={(e) => setSimulatedPortions(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 px-3 py-1.5 text-sm font-bold text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white shadow-sm"
              />
            </div>
          </div>

          {ingredients.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {calculatedIngredients.map((item, idx) => {
                const totalReq = Number((item.quantity * simulatedPortions).toFixed(3));
                const currentStock = item.invItem?.currentStock || 0;
                const isShortage = currentStock < totalReq;

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                      isShortage
                        ? "bg-red-50/80 border-red-200 text-red-900"
                        : "bg-white border-gray-200 text-gray-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold truncate">{item.invItem?.nameAr || "مكون"}</span>
                      {isShortage ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          عجز رصيد!
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" />
                          متوفر
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-gray-500 pt-1 border-t border-gray-100">
                      <span>الاحتياج لـ {simulatedPortions} وجبة:</span>
                      <span className="font-bold font-mono text-gray-900">
                        {totalReq} {formatUnit(item.unit)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-500">
                      <span>الرصيد الفعلي الحالي:</span>
                      <span className={`font-bold font-mono ${isShortage ? "text-red-700" : "text-gray-900"}`}>
                        {currentStock} {formatUnit(item.unit)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Disclaimer Note */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200/70 text-xs text-amber-800">
          <Info className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">تنبيه بشأن الفاقد والهدر التشغيلي أثناء الإعداد (Scrap & Prep Loss):</p>
            <p className="text-amber-700 leading-relaxed">
              هذه المعايير تعكس الاستهلاك النظري للوجبة. في حال وجود فاقد أثناء التقطيع أو التجهيز، يرجى تسجيله عبر شاشة{" "}
              <Link href="/inventory/adjustments" className="underline font-semibold hover:text-amber-900">
                تسجيل الهدر والتسويات المخزنية
              </Link>{" "}
              للحفاظ على مطابقة دقيقة للأرصدة الدفترية مع الجرد الفعلي.
            </p>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between pt-2">
          <Link
            href="/inventory/recipes"
            className="px-4 py-2.5 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
          >
            إلغاء
          </Link>

          <button
            type="submit"
            disabled={isSubmitting || ingredients.length === 0}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-lg shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "جاري الحفظ..." : "حفظ وصفة المكونات"}
          </button>
        </div>
      </form>
    </div>
  );
}
