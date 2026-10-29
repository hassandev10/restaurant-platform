"use client";

import React from "react";
import { ContractUnavailableBanner, EndpointContractItem } from "@/components/shared/contract-unavailable-banner";
import { TicketPercent, Tag, Gift, AlertCircle } from "lucide-react";

export function PromotionsView() {
  const contracts: EndpointContractItem[] = [
    {
      method: "GET",
      endpoint: "/api/v1/admin/promotions",
      descriptionAr: "استرجاع قائمة كافة الكوبونات والخصومات الترويجية النشطة والمنتهية في المطعم",
      status: "PENDING_BACKEND",
      sampleResponse: JSON.stringify(
        [
          {
            id: "promo-01",
            code: "WELCOME10",
            titleAr: "خصم الترحيب للزبائن الجدد",
            discountType: "PERCENTAGE",
            discountValue: 10,
            minOrderTotal: 150,
            maxDiscount: 50,
            usageLimit: 500,
            usedCount: 42,
            startDate: "2026-10-01T00:00:00Z",
            endDate: "2026-12-31T23:59:59Z",
            isActive: true,
          },
          {
            id: "promo-02",
            code: "FAMILY50",
            titleAr: "خصم الوجبات العائلية",
            discountType: "FIXED_AMOUNT",
            discountValue: 50,
            minOrderTotal: 300,
            usedCount: 18,
            startDate: "2026-10-15T00:00:00Z",
            endDate: "2026-11-15T23:59:59Z",
            isActive: true,
          },
        ],
        null,
        2
      ),
    },
    {
      method: "POST",
      endpoint: "/api/v1/admin/promotions",
      descriptionAr: "إنشاء كود خصم جديد بنسبة مئوية أو قيمة نقدية ثابتة مع شروط الحد الأدنى للطلب",
      status: "PENDING_BACKEND",
      samplePayload: JSON.stringify(
        {
          code: "SAVE20",
          titleAr: "خصم 20% على المشويات",
          discountType: "PERCENTAGE",
          discountValue: 20,
          minOrderTotal: 200,
          maxDiscount: 60,
          usageLimit: 100,
          startDate: "2026-11-01T00:00:00Z",
          endDate: "2026-11-30T23:59:59Z",
          isActive: true,
        },
        null,
        2
      ),
      sampleResponse: JSON.stringify(
        {
          id: "promo-03",
          code: "SAVE20",
          titleAr: "خصم 20% على المشويات",
          discountType: "PERCENTAGE",
          discountValue: 20,
          usedCount: 0,
          isActive: true,
          createdAt: "2026-10-27T23:45:00Z",
        },
        null,
        2
      ),
    },
    {
      method: "PATCH",
      endpoint: "/api/v1/admin/promotions/:id/status",
      descriptionAr: "تفعيل أو إيقاف الكوبون مؤقتاً بواسطة المشرف",
      status: "PENDING_BACKEND",
      samplePayload: JSON.stringify({ isActive: false }, null, 2),
    },
    {
      method: "DELETE",
      endpoint: "/api/v1/admin/promotions/:id",
      descriptionAr: "حذف العرض الترويجي نهائياً من قاعدة البيانات",
      status: "PENDING_BACKEND",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Contract Unavailable Banner */}
      <ContractUnavailableBanner
        title="شاشة العروض الترويجية وكوبونات الخصم"
        moduleNameAr="نظام الخصومات والعروض (Promotions & Coupons)"
        contracts={contracts}
        alternativeActionDescription="تخضع العروض الترويجية لقواعد احتساب الفواتير في الخادم لمنع التلاعب بالأسعار عند إنشاء الطلب (POST /api/v1/orders). لذلك لا يمكن محاكاتها ببيانات وهمية حتى يتم تطبيقها في خادم Go Backend."
      />

      {/* Database Schema Requirements Architecture Box */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-stone-100">
          <div className="w-8 h-8 rounded-lg bg-forest-50 text-forest-700 flex items-center justify-center">
            <TicketPercent className="w-4 h-4" />
          </div>
          <h3 className="font-bold font-cairo text-base text-stone-900">
            مواصفات جدول قاعدة البيانات المقترح في PostgreSQL
          </h3>
        </div>

        <p className="text-xs text-stone-600 mb-4 leading-relaxed">
          لتفعيل هذه الواجهة بالكامل في مشروع Go Backend، يُقترح تنفيذ الـ Migration التالي في مجلد <code>migrations/</code> الخاص بالسيرفر:
        </p>

        <pre className="p-4 bg-stone-900 text-stone-100 rounded-xl font-mono text-xs overflow-x-auto text-left" dir="ltr">
{`CREATE TABLE restaurant_promotions (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    code VARCHAR(32) NOT NULL UNIQUE,
    title_ar VARCHAR(128) NOT NULL,
    description_ar TEXT,
    discount_type VARCHAR(16) NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
    min_order_total NUMERIC(10, 2) DEFAULT 0,
    max_discount NUMERIC(10, 2),
    usage_limit INT,
    used_count INT DEFAULT 0,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_promotions_code ON restaurant_promotions(LOWER(code));
CREATE INDEX idx_promotions_active ON restaurant_promotions(restaurant_id, is_active);`}
        </pre>
      </div>
    </div>
  );
}
