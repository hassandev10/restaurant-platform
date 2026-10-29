"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { formatUnit, getItemTypeConfig } from "@/lib/formatters";
import { inventoryService } from "@/services/inventory-service";
import {
  InventoryBaseUnit,
  InventoryItem,
  InventoryItemType,
  InventoryPurchaseUnit,
  ItemCategory,
} from "@/types/inventory";
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  Calculator,
  Check,
  Info,
  Lock,
  Plus,
  Save,
  Scale,
} from "lucide-react";

interface ItemFormProps {
  initialItem?: InventoryItem | null;
  isEditing?: boolean;
}

export function ItemForm({ initialItem, isEditing = false }: ItemFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [sku, setSku] = useState(initialItem?.sku || "");
  const [nameAr, setNameAr] = useState(initialItem?.nameAr || "");
  const [nameEn, setNameEn] = useState(initialItem?.nameEn || "");
  const [type, setType] = useState<InventoryItemType>(initialItem?.type || "RAW_INGREDIENT");
  const [category, setCategory] = useState<ItemCategory>(initialItem?.category || "MEAT");
  const [baseUnit, setBaseUnit] = useState<InventoryBaseUnit>(initialItem?.baseUnit || "kg");
  const [minStockThreshold, setMinStockThreshold] = useState<number>(initialItem?.minStockThreshold ?? 5);
  const [costPerBaseUnit, setCostPerBaseUnit] = useState<number>(initialItem?.costPerBaseUnit ?? 0);
  const [isActive, setIsActive] = useState<boolean>(initialItem?.isActive ?? true);
  const [purchaseUnit, setPurchaseUnit] = useState<InventoryPurchaseUnit>(initialItem?.purchaseUnit || "kg");
  const [conversionFactor, setConversionFactor] = useState<number>(initialItem?.conversionFactor ?? 1);
  const [description, setDescription] = useState(initialItem?.description || "");

  // Update conversion factor default if purchaseUnit matches baseUnit
  useEffect(() => {
    if (purchaseUnit === baseUnit) {
      setConversionFactor(1);
    }
  }, [purchaseUnit, baseUnit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nameAr.trim()) {
      toast.error("يرجى إدخال اسم الصنف باللغة العربية");
      return;
    }
    if (!sku.trim()) {
      toast.error("يرجى إدخال كود الصنف الداخلي (SKU)");
      return;
    }
    if (conversionFactor <= 0) {
      toast.error("معامل التحويل يجب أن يكون أكبر من الصفر");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && initialItem) {
        const res = await inventoryService.updateItem(initialItem.id, {
          nameAr: nameAr.trim(),
          nameEn: nameEn.trim() || undefined,
          category,
          minStockThreshold: Number(minStockThreshold),
          costPerBaseUnit: Number(costPerBaseUnit),
          isActive,
          purchaseUnit,
          conversionFactor: Number(conversionFactor),
          description: description.trim() || undefined,
        });

        toast.success(
          res.isContractLive
            ? "تم تحديث مواصفات الصنف بنجاح في قاعدة البيانات"
            : "تم حفظ التعديلات بنجاح في سجل الأصناف."
        );
        router.push(`/inventory/items/${initialItem.id}`);
      } else {
        const res = await inventoryService.createItem({
          sku: sku.trim().toUpperCase(),
          nameAr: nameAr.trim(),
          nameEn: nameEn.trim() || undefined,
          type,
          category,
          baseUnit,
          minStockThreshold: Number(minStockThreshold),
          costPerBaseUnit: Number(costPerBaseUnit),
          isActive,
          purchaseUnit,
          conversionFactor: Number(conversionFactor),
          description: description.trim() || undefined,
        });

        toast.success(
          res.isContractLive
            ? "تمت إضافة الصنف بنجاح في قاعدة البيانات"
            : "تمت إضافة الصنف في دليل المخزون بنجاح (برصيد أولي 0)."
        );
        router.push(`/inventory/items/${res.item.id}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشلت العملية";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top back button */}
      <div className="flex items-center justify-between">
        <Link
          href={isEditing && initialItem ? `/inventory/items/${initialItem.id}` : "/inventory/items"}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 bg-white px-3 py-1.5 rounded-xl border border-stone-200 transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لقائمة الأصناف</span>
        </Link>
        <span className="text-xs text-stone-400">
          {isEditing ? `تعديل صنف: ${initialItem?.sku}` : "تعريف صنف مخزني جديد"}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-stone-200 p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex items-start justify-between pb-4 border-b border-stone-100">
          <div>
            <h2 className="text-lg font-bold font-cairo text-stone-900">
              {isEditing ? `تعديل الصنف: ${initialItem?.nameAr}` : "تسجيل صنف مخزني جديد"}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              حدد طبيعة الصنف (مادة خام أو منتج مباع)، وحدة الصرف الدفترية، ومعاملات التحويل
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        {/* Read-only stock protection notice when editing */}
        {isEditing && initialItem && (
          <div className="p-4 bg-cream-50 border border-stone-200 rounded-2xl flex items-start gap-3">
            <Lock className="w-5 h-5 text-forest-700 shrink-0 mt-0.5" />
            <div className="text-xs text-stone-700 space-y-1">
              <div className="font-bold text-stone-900">
                الرصيد الفعلي الحالي: <span className="font-mono text-forest-800 text-sm">{initialItem.currentStock} {formatUnit(initialItem.baseUnit)}</span> (محمي ضد التعديل اليدوي المباشر)
              </div>
              <p className="text-stone-500 text-[11px] leading-relaxed">
                وفقاً لمعايير الرقابة والتدقيق المخزني الصارمة، لا يُسمح بتعديل رصيد المخزون بالكتابة اليدوية المباشرة. يتم تعديل الرصيد حصرياً عبر أذون التوريد المعتمدة أو حركات التسوية والهدر ومطابقة الجرد الفعلي.
              </p>
            </div>
          </div>
        )}

        {/* Item Type & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              نوع الصنف المخزني <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              disabled={isEditing}
              onChange={(e) => setType(e.target.value as InventoryItemType)}
              className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none text-stone-800 disabled:opacity-75 disabled:cursor-not-allowed"
            >
              <option value="RAW_INGREDIENT">مادة خام تدخل في الوصفات (لحوم، دقيق، زيوت، جبن)</option>
              <option value="FINISHED_GOOD">منتج نهائي مباع مباشرة (مياه معبأة، كانز، معلبات)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              تصنيف المستودع <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ItemCategory)}
              className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none text-stone-800"
            >
              <option value="MEAT">لحوم ومصنعاتها</option>
              <option value="POULTRY">دواجن وطيور</option>
              <option value="VEGETABLES">خضروات وفواكه</option>
              <option value="DAIRY">ألبان وأجبان</option>
              <option value="DRY_GOODS">حبوب وبقوليات</option>
              <option value="SPICES">توابل وبهارات</option>
              <option value="BEVERAGES">مشروبات ومعلبات</option>
              <option value="BAKERY">مخبوزات ودقيق</option>
              <option value="PACKAGING">تعبئة وتغليف</option>
              <option value="OTHER">أصناف عامة</option>
            </select>
          </div>
        </div>

        {/* SKU & Names */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              كود الصنف (SKU / Barcode) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={sku}
              disabled={isEditing}
              onChange={(e) => setSku(e.target.value)}
              placeholder="مثال: RAW-MEAT-001"
              dir="ltr"
              className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none font-mono uppercase text-stone-800 disabled:opacity-75 disabled:cursor-not-allowed"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              الاسم باللغة العربية <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="مثال: لحم كباب وكفتة بلدي"
              className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none text-stone-800"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              الاسم بالإنجليزية (اختياري)
            </label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="Example: Minced Beef"
              dir="ltr"
              className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none text-stone-800"
            />
          </div>
        </div>

        {/* Units & Conversion Setup */}
        <div className="p-4 rounded-2xl bg-forest-50/50 border border-forest-200/60 space-y-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-forest-700" />
            <h3 className="text-xs font-bold font-cairo text-forest-900">
              إعدادات وحدات الصرف والتوريد ومعامل التحويل
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                وحدة الصرف والوصفات (Base Unit) <span className="text-red-500">*</span>
              </label>
              <select
                value={baseUnit}
                disabled={isEditing}
                onChange={(e) => setBaseUnit(e.target.value as InventoryBaseUnit)}
                className="w-full px-3.5 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 text-stone-800 disabled:opacity-75"
              >
                <option value="kg">كيلوجرام (kg)</option>
                <option value="g">جرام (g)</option>
                <option value="l">لتر (l)</option>
                <option value="ml">مليلتر (ml)</option>
                <option value="piece">قطعة فردية (piece)</option>
              </select>
              <span className="text-[10px] text-stone-400 mt-1 block">الوحدة المعتمدة في جرد المطبخ والوصفات</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                وحدة الشراء المعتادة (Purchase Unit)
              </label>
              <select
                value={purchaseUnit}
                onChange={(e) => setPurchaseUnit(e.target.value as InventoryPurchaseUnit)}
                className="w-full px-3.5 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 text-stone-800"
              >
                <option value={baseUnit}>نفس وحدة الأساس ({formatUnit(baseUnit)})</option>
                <option value="carton">كرتونة (Carton)</option>
                <option value="box">علبة / باكت (Box)</option>
                <option value="sack">شيكارة / جوال (Sack)</option>
                <option value="can">صفيحة / كانز (Can)</option>
                <option value="bottle">زجاجة (Bottle)</option>
              </select>
              <span className="text-[10px] text-stone-400 mt-1 block">الوحدة الواردة في فواتير الموردين</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                معامل التحويل (Conversion Factor)
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={conversionFactor}
                onChange={(e) => setConversionFactor(parseFloat(e.target.value) || 1)}
                className="w-full px-3.5 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 text-stone-800 font-mono"
                required
              />
              <span className="text-[10px] text-stone-400 mt-1 block">كمية وحدة الأساس في وحدة الشراء</span>
            </div>
          </div>

          {/* Live Conversion Preview */}
          <div className="p-3 bg-white rounded-xl border border-stone-200 text-xs flex items-center justify-between">
            <span className="text-stone-500">معادلة التوريد المحتسبة تلقائياً:</span>
            <div className="font-bold text-forest-900 font-mono" dir="ltr">
              1 {formatUnit(purchaseUnit)} = {conversionFactor} {formatUnit(baseUnit)}
            </div>
          </div>
        </div>

        {/* Thresholds & Cost */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              حد الأمان الأدنى للتنبيه (Min Threshold) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                value={minStockThreshold}
                onChange={(e) => setMinStockThreshold(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 text-stone-800 font-mono"
                required
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">
                {formatUnit(baseUnit)}
              </span>
            </div>
            <span className="text-[10px] text-stone-400 mt-1 block">
              يُطلق النظام تنبيهاً فور هبوط الرصيد الفعلي دون هذه القيمة
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              متوسط تكلفة الوحدة الأساسية (ج.م)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                value={costPerBaseUnit}
                onChange={(e) => setCostPerBaseUnit(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 text-stone-800 font-mono"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">
                ج.م / {formatUnit(baseUnit)}
              </span>
            </div>
            <span className="text-[10px] text-stone-400 mt-1 block">
              تُستخدم في تقدير تكلفة الوجبات وتقييم المستودع
            </span>
          </div>
        </div>

        {/* Description & Status */}
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1.5">
            ملاحظات ووصف الصنف
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="مواصفات التخزين، المورد المفضل، أو أي ملاحظات تشغيلية..."
            className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 text-stone-800"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 text-forest-700 rounded focus:ring-forest-600"
          />
          <label htmlFor="isActive" className="text-xs font-bold text-stone-800 cursor-pointer select-none">
            الصنف نشط ومتاح في دورة التوريد والوصفات
          </label>
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-3">
          <Link
            href="/inventory/items"
            className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:text-stone-900 bg-cream-100 hover:bg-cream-200 rounded-xl transition"
          >
            إلغاء
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-xs font-bold text-white bg-forest-900 hover:bg-forest-800 disabled:bg-stone-300 rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Save className="w-4 h-4 text-gold-400" />
            <span>{isSubmitting ? "جاري الحفظ..." : isEditing ? "حفظ التعديلات" : "إنشاء الصنف"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
