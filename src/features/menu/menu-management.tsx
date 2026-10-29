"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { formatCurrency } from "@/lib/formatters";
import { CONFIG } from "@/lib/config";
import { menuService } from "@/services/menu-service";
import { MenuCategory, Product, ProductOptionGroup } from "@/types/menu";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Edit2,
  ExternalLink,
  Eye,
  FolderPlus,
  Image as ImageIcon,
  Layers,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";

export function MenuManagement() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "unavailable">("all");

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Add/Edit Form State
  const [formNameAr, setFormNameAr] = useState("");
  const [formNameEn, setFormNameEn] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formDiscountPrice, setFormDiscountPrice] = useState<number | undefined>(undefined);
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formIsAvailable, setFormIsAvailable] = useState(true);
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formBadge, setFormBadge] = useState("");
  const [formOptions, setFormOptions] = useState<ProductOptionGroup[]>([]);

  // Category creation form
  const [newCatNameAr, setNewCatNameAr] = useState("");
  const [newCatNameEn, setNewCatNameEn] = useState("");
  const [newCatOrder, setNewCatOrder] = useState(1);

  const loadMenu = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await menuService.getMenu();
      setCategories(data.categories || []);
      setProducts(data.products || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تحميل قائمة الطعام";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory =
        selectedCategory === "all" || p.categoryId === selectedCategory;

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.nameAr.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q));

      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "available" && p.isAvailable) ||
        (availabilityFilter === "unavailable" && !p.isAvailable);

      return matchesCategory && matchesSearch && matchesAvailability;
    });
  }, [products, selectedCategory, searchQuery, availabilityFilter]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormNameAr("");
    setFormNameEn("");
    setFormCategoryId(categories[0]?.id || "");
    setFormDescription("");
    setFormPrice(0);
    setFormDiscountPrice(undefined);
    setFormImageUrl("");
    setFormIsAvailable(true);
    setFormIsFeatured(false);
    setFormBadge("");
    setFormOptions([]);
    setIsAddEditModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormNameAr(product.nameAr);
    setFormNameEn(product.nameEn || "");
    setFormCategoryId(product.categoryId);
    setFormDescription(product.description || "");
    setFormPrice(product.price);
    setFormDiscountPrice(product.discountPrice);
    setFormImageUrl(product.imageUrl || "");
    setFormIsAvailable(product.isAvailable);
    setFormIsFeatured(product.isFeatured);
    setFormBadge(product.badge || "");
    setFormOptions(product.options || []);
    setIsAddEditModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNameAr.trim()) {
      toast.error("يرجى إدخال اسم الصنف باللغة العربية");
      return;
    }
    if (!formCategoryId) {
      toast.error("يرجى اختيار تصنيف للصنف");
      return;
    }
    if (formPrice <= 0) {
      toast.error("يرجى إدخال سعر صحيح للصنف");
      return;
    }

    if (editingProduct) {
      // Update
      const res = await menuService.updateProduct(editingProduct.id, {
        nameAr: formNameAr,
        nameEn: formNameEn,
        categoryId: formCategoryId,
        description: formDescription,
        price: formPrice,
        discountPrice: formDiscountPrice,
        imageUrl: formImageUrl,
        isAvailable: formIsAvailable,
        isFeatured: formIsFeatured,
        badge: formBadge,
        options: formOptions,
      });

      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? res.product : p))
      );

      toast.success(
        res.isContractLive
          ? "تم تحديث الصنف بنجاح في قاعدة البيانات"
          : "تم حفظ التعديلات محلياً. (ملاحظة: نقطة النهاية PATCH /api/v1/admin/products غير مفعلة بعد في الخادم)"
      );
    } else {
      // Create
      const res = await menuService.createProduct({
        nameAr: formNameAr,
        nameEn: formNameEn,
        categoryId: formCategoryId,
        description: formDescription,
        price: formPrice,
        discountPrice: formDiscountPrice,
        imageUrl: formImageUrl,
        isAvailable: formIsAvailable,
        isFeatured: formIsFeatured,
        badge: formBadge,
        options: formOptions,
      });

      setProducts((prev) => [res.product, ...prev]);

      toast.success(
        res.isContractLive
          ? "تمت إضافة الصنف بنجاح في قاعدة البيانات"
          : "تمت إضافة الصنف في واجهة المنيو. (ملاحظة: نقطة النهاية POST /api/v1/admin/products غير مفعلة بعد في الخادم)"
      );
    }

    setIsAddEditModalOpen(false);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا الصنف من قائمة الطعام؟")) return;

    const res = await menuService.deleteProduct(productId);
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    toast.success(
      res.isContractLive
        ? "تم حذف الصنف بنجاح"
        : "تم حذف الصنف من واجهة العرض (تم توثيق عقد DELETE في الخادم)"
    );
  };

  const handleToggleAvailability = async (product: Product) => {
    const updatedStatus = !product.isAvailable;
    const res = await menuService.toggleAvailability(product.id, updatedStatus);

    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isAvailable: updatedStatus } : p))
    );

    toast.info(
      updatedStatus
        ? `تم تفعيل إتاحة صنف "${product.nameAr}"`
        : `تم إيقاف صنف "${product.nameAr}" مؤقتاً (غير متوفر)`
    );
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatNameAr.trim()) {
      toast.error("يرجى إدخال اسم التصنيف بالعربية");
      return;
    }

    const res = await menuService.createCategory({
      nameAr: newCatNameAr.trim(),
      nameEn: newCatNameEn.trim() || undefined,
      displayOrder: Number(newCatOrder) || 1,
      isActive: true,
    });

    setCategories((prev) => [...prev, res.category]);
    setNewCatNameAr("");
    setNewCatNameEn("");
    toast.success("تمت إضافة التصنيف الجديد بنجاح");
  };

  if (isLoading) {
    return <LoadingState message="جاري استرجاع قائمة الأصناف والتصنيفات..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadMenu} />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Title and Action Buttons */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-stone-900 font-cairo">
              إدارة قائمة الطعام والمنتجات
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-forest-50 text-forest-800 font-bold border border-forest-200">
              {products.length} صنف مسجل
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            إضافة وتعديل الأصناف، ضبط الأسعار والإضافات، والتحكم في إتاحة المنتجات للزبائن
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsPreviewModalOpen(true)}
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-stone-700 bg-cream-50 hover:bg-cream-100 border border-stone-200 rounded-xl transition-colors"
          >
            <Eye className="w-4 h-4 text-stone-500" />
            <span>معاينة منيو الزبائن</span>
          </button>

          <button
            onClick={() => setIsCategoriesModalOpen(true)}
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-forest-800 bg-forest-50 hover:bg-forest-100 border border-forest-200 rounded-xl transition-colors"
          >
            <Layers className="w-4 h-4 text-forest-600" />
            <span>إدارة التصنيفات ({categories.length})</span>
          </button>

          <button
            onClick={openAddModal}
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-forest-900 hover:bg-forest-800 rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-gold-400" />
            <span>إضافة صنف جديد</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedCategory("all")}
            type="button"
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === "all"
                ? "bg-forest-900 text-white shadow-xs"
                : "bg-cream-100 text-stone-600 hover:bg-cream-200 hover:text-stone-900"
            }`}
          >
            كل الأصناف ({products.length})
          </button>

          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                type="button"
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-forest-900 text-white shadow-xs"
                    : "bg-cream-100 text-stone-600 hover:bg-cream-200 hover:text-stone-900"
                }`}
              >
                <span>{cat.nameAr}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? "bg-forest-800 text-gold-300" : "bg-stone-200/60 text-stone-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Availability Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-stone-100">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم العربي أو الإنجليزي أو الوصف..."
              className="w-full pr-10 pl-4 py-2 text-xs bg-cream-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700 text-stone-900 placeholder:text-stone-400"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-stone-500 font-semibold shrink-0">حالة التوفر:</span>
            <div className="inline-flex rounded-xl bg-cream-100 p-0.5 border border-stone-200 text-xs">
              <button
                onClick={() => setAvailabilityFilter("all")}
                type="button"
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  availabilityFilter === "all" ? "bg-white text-forest-900 shadow-xs" : "text-stone-600"
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setAvailabilityFilter("available")}
                type="button"
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  availabilityFilter === "available" ? "bg-white text-emerald-800 shadow-xs" : "text-stone-600"
                }`}
              >
                متاح فقط
              </button>
              <button
                onClick={() => setAvailabilityFilter("unavailable")}
                type="button"
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  availabilityFilter === "unavailable" ? "bg-white text-red-800 shadow-xs" : "text-stone-600"
                }`}
              >
                غير متوفر
              </button>
            </div>

            <button
              onClick={loadMenu}
              type="button"
              className="p-2 text-stone-500 hover:text-stone-900 hover:bg-cream-100 rounded-xl border border-stone-200 transition-colors"
              title="تحديث القائمة"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <UtensilsCrossed className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="text-stone-800 font-bold font-cairo text-base">لا توجد أصناف مطابقة</h3>
          <p className="text-stone-500 text-xs mt-1">
            جرب تغيير معايير البحث أو اختيار تصنيف مختلف
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((product) => {
            const category = categories.find((c) => c.id === product.categoryId);

            return (
              <div
                key={product.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-card flex flex-col ${
                  product.isAvailable ? "border-stone-200" : "border-stone-200/60 opacity-80"
                }`}
              >
                {/* Product Image Header */}
                <div className="relative h-44 w-full bg-cream-100 overflow-hidden group">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.nameAr}
                      fill
                      className={`object-cover transition-transform duration-500 group-hover:scale-105 ${
                        !product.isAvailable ? "grayscale contrast-75" : ""
                      }`}
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}

                  {/* Badges Overlay */}
                  <div className="absolute top-3 right-3 flex flex-col gap-1 items-start">
                    {category && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-forest-950/80 text-cream-100 backdrop-blur-sm border border-forest-800/40">
                        {category.nameAr}
                      </span>
                    )}
                    {product.badge && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gold-500 text-forest-950 shadow-xs">
                        {product.badge}
                      </span>
                    )}
                  </div>

                  {/* Availability Floating Switch */}
                  <div className="absolute top-3 left-3">
                    <button
                      onClick={() => handleToggleAvailability(product)}
                      type="button"
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm backdrop-blur-md transition-colors flex items-center gap-1.5 ${
                        product.isAvailable
                          ? "bg-emerald-600/90 hover:bg-emerald-700 text-white"
                          : "bg-red-600/90 hover:bg-red-700 text-white"
                      }`}
                      title="انقر لتغيير حالة توفر الصنف للزبائن"
                    >
                      <span className={`w-2 h-2 rounded-full ${product.isAvailable ? "bg-white" : "bg-red-200"}`} />
                      <span>{product.isAvailable ? "متاح للطلب" : "غير متوفر"}</span>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold font-cairo text-stone-900 text-base leading-snug">
                          {product.nameAr}
                        </h3>
                        {product.nameEn && (
                          <p className="text-xs text-stone-400 font-tajawal mt-0.5" dir="ltr">
                            {product.nameEn}
                          </p>
                        )}
                      </div>

                      <div className="text-left shrink-0">
                        <div className="font-black font-cairo text-forest-800 text-base">
                          {formatCurrency(product.price)}
                        </div>
                        {product.discountPrice && (
                          <div className="text-[11px] text-stone-400 line-through">
                            {formatCurrency(product.discountPrice)}
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-stone-500 line-clamp-2 mt-2 leading-relaxed">
                      {product.description || "لا يوجد وصف مسجل لهذا الصنف."}
                    </p>

                    {/* Options summary */}
                    {product.options && product.options.length > 0 && (
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-stone-600 bg-cream-50 p-2 rounded-lg border border-cream-200">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-forest-700 shrink-0" />
                        <span>
                          {product.options.length} مجموعات خيارات وإضافات (
                          {product.options.map((o) => o.nameAr).join("، ")})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-stone-400 font-mono">
                      #{product.id}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(product)}
                        type="button"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-700 hover:text-forest-800 hover:bg-cream-100 border border-stone-200 transition-colors"
                        title="تعديل بيانات الصنف"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>

                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        type="button"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 transition-colors"
                        title="حذف الصنف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 md:p-8 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-6">
              <div>
                <h3 className="text-xl font-bold font-cairo text-stone-900">
                  {editingProduct ? `تعديل الصنف: ${editingProduct.nameAr}` : "إضافة صنف جديد لقائمة الطعام"}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  أدخل تفاصيل الصنف بدقة لضمان ظهورها المتناسق في منيو الزبائن
                </p>
              </div>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                type="button"
                className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-cream-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    الاسم باللغة العربية <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formNameAr}
                    onChange={(e) => setFormNameAr(e.target.value)}
                    placeholder="مثال: شاورما لحم عربي"
                    className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    الاسم باللغة الإنجليزية (اختياري)
                  </label>
                  <input
                    type="text"
                    value={formNameEn}
                    onChange={(e) => setFormNameEn(e.target.value)}
                    placeholder="Example: Beef Shawarma Arabic"
                    dir="ltr"
                    className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    التصنيف <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                    required
                  >
                    <option value="" disabled>اختر التصنيف...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    السعر الأساسي (ج.م) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={formPrice}
                    onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    سعر قبل الخصم (اختياري)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formDiscountPrice || ""}
                    onChange={(e) => setFormDiscountPrice(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="سعر المقارنة للشطب"
                    className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  الوصف التفصيلي
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="مكونات الصنف، طريقة التقديم، أو أي تفاصيل تسويقية..."
                  className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  رابط صورة الصنف (Image URL)
                </label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    شارة ترويجية (Badge)
                  </label>
                  <input
                    type="text"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    placeholder="مثال: الأكثر طلباً، عرض خاص، جديد"
                    className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-6 pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formIsAvailable}
                      onChange={(e) => setFormIsAvailable(e.target.checked)}
                      className="w-4 h-4 text-forest-700 rounded focus:ring-forest-600"
                    />
                    <span className="text-xs font-bold text-stone-800">متاح للطلب الآن</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formIsFeatured}
                      onChange={(e) => setFormIsFeatured(e.target.checked)}
                      className="w-4 h-4 text-forest-700 rounded focus:ring-forest-600"
                    />
                    <span className="text-xs font-bold text-stone-800">صنف مميز (Featured)</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:text-stone-900 bg-cream-100 hover:bg-cream-200 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-bold text-white bg-forest-900 hover:bg-forest-800 rounded-xl shadow-xs transition-colors"
                >
                  {editingProduct ? "حفظ التعديلات" : "إضافة الصنف"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories Management Drawer / Modal */}
      {isCategoriesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 md:p-8">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-cairo text-stone-900">إدارة تصنيفات المنيو</h3>
                  <p className="text-xs text-stone-500">ترتيب وتنظيم أقسام قائمة الطعام</p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoriesModalOpen(false)}
                type="button"
                className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-cream-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Existing Categories List */}
            <div className="space-y-2 mb-6 max-h-56 overflow-y-auto pr-1">
              {categories.map((c, idx) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-cream-50 border border-stone-200 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-forest-100 text-forest-800 font-bold flex items-center justify-center text-[10px]">
                      {c.displayOrder || idx + 1}
                    </span>
                    <span className="font-bold text-stone-800">{c.nameAr}</span>
                    {c.nameEn && <span className="text-stone-400" dir="ltr">({c.nameEn})</span>}
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    نشط
                  </span>
                </div>
              ))}
            </div>

            {/* Add New Category Inline Form */}
            <form onSubmit={handleAddCategory} className="pt-4 border-t border-stone-100 space-y-3">
              <h4 className="text-xs font-bold text-stone-700">إضافة تصنيف جديد:</h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newCatNameAr}
                  onChange={(e) => setNewCatNameAr(e.target.value)}
                  placeholder="اسم التصنيف بالعربية"
                  className="px-3 py-2 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700"
                  required
                />
                <input
                  type="text"
                  value={newCatNameEn}
                  onChange={(e) => setNewCatNameEn(e.target.value)}
                  placeholder="Name in English"
                  dir="ltr"
                  className="px-3 py-2 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700"
                />
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                <input
                  type="number"
                  min="1"
                  value={newCatOrder}
                  onChange={(e) => setNewCatOrder(parseInt(e.target.value) || 1)}
                  placeholder="ترتيب العرض"
                  className="w-28 px-3 py-2 text-xs bg-cream-50 border border-stone-300 rounded-xl"
                  title="رقم ترتيب العرض في المنيو"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-forest-900 hover:bg-forest-800 rounded-xl transition"
                >
                  إضافة التصنيف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Menu Live Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-sm">
          <div className="relative w-full max-w-sm md:max-w-md bg-stone-900 rounded-3xl shadow-2xl p-4 flex flex-col border border-stone-700 max-h-[92vh]">
            {/* Phone Bezel Header */}
            <div className="flex items-center justify-between pb-3 px-2 border-b border-stone-800 text-stone-300">
              <span className="text-xs font-mono">معاينة واجهة الزبائن الحية</span>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                type="button"
                className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Viewport Container */}
            <div className="flex-1 overflow-y-auto bg-cream-100 rounded-2xl my-2 p-4 text-stone-900">
              <div className="text-center pb-4 border-b border-stone-200">
                <h4 className="font-bold font-cairo text-lg text-forest-950">مطعم الزيتونة</h4>
                <p className="text-xs text-stone-500">أشهى المأكولات والمشويات المصرية</p>
                <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  مفتوح للطلب الفوري
                </span>
              </div>

              {/* Sample Categories in Phone Preview */}
              <div className="mt-4 space-y-4">
                {categories.slice(0, 3).map((cat) => {
                  const catProducts = products.filter((p) => p.categoryId === cat.id && p.isAvailable);
                  if (catProducts.length === 0) return null;

                  return (
                    <div key={cat.id}>
                      <h5 className="font-bold text-xs text-stone-700 mb-2 font-cairo border-r-2 border-forest-700 pr-2">
                        {cat.nameAr}
                      </h5>
                      <div className="space-y-2">
                        {catProducts.slice(0, 2).map((item) => (
                          <div key={item.id} className="p-2.5 rounded-xl bg-white border border-stone-200 shadow-2xs flex items-center justify-between gap-2">
                            <div>
                              <p className="font-bold text-xs text-stone-900">{item.nameAr}</p>
                              <p className="text-[10px] text-stone-500 line-clamp-1">{item.description}</p>
                              <span className="font-bold text-xs text-forest-800 mt-1 inline-block">
                                {formatCurrency(item.price)}
                              </span>
                            </div>
                            {item.imageUrl && (
                              <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
                                <Image src={item.imageUrl} alt={item.nameAr} fill className="object-cover" sizes="48px" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 text-center">
              <a
                href={`${CONFIG.customerFrontendUrl}/r/${CONFIG.defaultRestaurantSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gold-400 hover:text-gold-300 font-bold inline-flex items-center gap-1.5"
              >
                <span>فتح واجهة الزبائن الكاملة في نافذة جديدة</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
