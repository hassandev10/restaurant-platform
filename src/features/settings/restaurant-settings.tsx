"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { CONFIG } from "@/lib/config";
import { restaurantService } from "@/services/restaurant-service";
import { Restaurant } from "@/types/restaurant";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { toast } from "sonner";
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  ImageIcon,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Store,
} from "lucide-react";

export function RestaurantSettings() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [isOpen, setIsOpen] = useState(true);
  const [estimatedPrepMinutes, setEstimatedPrepMinutes] = useState(25);
  const [contactPhone, setContactPhone] = useState("+20 100 123 4567");
  const [contactEmail, setContactEmail] = useState("info@al-zaytouna.com");
  const [address, setAddress] = useState("شارع 9، المعادي، القاهرة، مصر");
  const [openingHours, setOpeningHours] = useState("يومياً من 11:00 صباحاً حتى 01:00 بعد منتصف الليل");

  const [copiedUrl, setCopiedUrl] = useState(false);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await restaurantService.getRestaurant();
      setRestaurant(data);
      setName(data.name || "");
      setDescription(data.description || "");
      setLogoUrl(data.logoUrl || "");
      setCurrency(data.currency || "EGP");
      setIsOpen(data.isOpen ?? true);
      setEstimatedPrepMinutes(data.estimatedPreparationMinutes || 25);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تحميل إعدادات المطعم";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("اسم المطعم مطلوب");
      return;
    }

    setIsSaving(true);
    try {
      const res = await restaurantService.updateSettings(CONFIG.defaultRestaurantSlug, {
        name,
        description,
        logoUrl,
        currency,
        isOpen,
        estimatedPreparationMinutes: estimatedPrepMinutes,
        contactPhone,
        contactEmail,
        address,
        openingHours,
      });

      setRestaurant(res.data);
      if (res.isBackendEndpointAvailable) {
        toast.success(res.message);
      } else {
        toast.info(res.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر حفظ الإعدادات";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const publicMenuUrl = `${CONFIG.customerFrontendUrl}/r/${restaurant?.slug || CONFIG.defaultRestaurantSlug}`;

  const copyPublicUrl = () => {
    navigator.clipboard.writeText(publicMenuUrl);
    setCopiedUrl(true);
    toast.success("تم نسخ رابط المنيو العام إلى الحافظة");
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (isLoading) {
    return <LoadingState message="جاري استرجاع إعدادات المطعم الحالية..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadSettings} />;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-stone-900 font-cairo">
            إعدادات وهوية المطعم
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            البيانات الأساسية المعروضة للزبائن وساعات العمل وحالة استقبال الطلبات
          </p>
        </div>

        <button
          onClick={loadSettings}
          type="button"
          className="p-2 text-stone-500 hover:text-stone-900 hover:bg-cream-100 rounded-xl border border-stone-200 transition-colors"
          title="إعادة تحميل الإعدادات"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Public Customer Menu URL Box */}
      <div className="bg-forest-950 text-cream-100 p-6 rounded-2xl border border-forest-800 shadow-soft">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-gold-400" />
              <h3 className="font-bold font-cairo text-sm text-gold-300">
                رابط قائمة طعام الزبائن المباشر (Public Menu URL)
              </h3>
            </div>
            <p className="text-xs text-cream-300 font-mono" dir="ltr">
              {publicMenuUrl}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyPublicUrl}
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-forest-800 hover:bg-forest-700 text-cream-100 rounded-xl border border-forest-700 transition"
            >
              {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedUrl ? "تم النسخ" : "نسخ الرابط"}</span>
            </button>

            <a
              href={publicMenuUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-gold-500 hover:bg-gold-400 text-forest-950 rounded-xl transition shadow-xs"
            >
              <span>فتح المنيو</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSaveSettings} className="bg-white p-6 md:p-8 rounded-3xl border border-stone-200 shadow-xs space-y-6">
        {/* Basic Info */}
        <div>
          <h3 className="font-bold text-sm text-stone-900 font-cairo mb-4 pb-2 border-b border-stone-100">
            البيانات الأساسية للمنشأة
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                اسم المطعم <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                الاسم المعرف في الروابط (Slug)
              </label>
              <input
                type="text"
                value={restaurant?.slug || CONFIG.defaultRestaurantSlug}
                disabled
                dir="ltr"
                className="w-full px-3.5 py-2.5 text-sm bg-stone-100 border border-stone-300 rounded-xl text-stone-500 font-mono cursor-not-allowed"
                title="معرف المطعم ثابت في قاعدة البيانات"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              الوصف التسويقي للمطعم
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
            />
          </div>
        </div>

        {/* Branding & Visuals */}
        <div>
          <h3 className="font-bold text-sm text-stone-900 font-cairo mb-4 pb-2 border-b border-stone-100">
            الهوية البصرية والشعار
          </h3>

          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-20 h-20 rounded-2xl bg-cream-100 border border-stone-200 overflow-hidden relative shrink-0 shadow-xs">
              {logoUrl ? (
                <Image src={logoUrl} alt="Logo preview" fill className="object-cover" sizes="80px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-400">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
            </div>

            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                رابط شعار المطعم (Logo Image URL)
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                dir="ltr"
                className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Operating status & Timing */}
        <div>
          <h3 className="font-bold text-sm text-stone-900 font-cairo mb-4 pb-2 border-b border-stone-100">
            حالة التشغيل وأوقات التجهيز
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                استقبال طلبات الزبائن (Open / Closed)
              </label>
              <select
                value={isOpen ? "open" : "closed"}
                onChange={(e) => setIsOpen(e.target.value === "open")}
                className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
              >
                <option value="open">مفتوح ويستقبل الطلبات فوراً</option>
                <option value="closed">مغلق مؤقتاً (لا يقبل طلبات جديدة)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                متوسط وقت التجهيز التقديري (بالدقائق)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={estimatedPrepMinutes}
                onChange={(e) => setEstimatedPrepMinutes(parseInt(e.target.value) || 20)}
                className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                العملة المعتمدة
              </label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                dir="ltr"
                className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Contact & Address */}
        <div>
          <h3 className="font-bold text-sm text-stone-900 font-cairo mb-4 pb-2 border-b border-stone-100">
            بيانات الاتصال والعنوان
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                رقم هاتف المطعم
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                dir="ltr"
                className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                البريد الإلكتروني للإدارة
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                dir="ltr"
                className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                العنوان التفصيلي
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                مواعيد العمل
              </label>
              <input
                type="text"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-stone-200 flex items-center justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-forest-900 hover:bg-forest-800 disabled:bg-stone-300 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-2 text-xs"
          >
            <Save className="w-4 h-4 text-gold-400" />
            <span>{isSaving ? "جاري حفظ الإعدادات..." : "حفظ بيانات وإعدادات المطعم"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
