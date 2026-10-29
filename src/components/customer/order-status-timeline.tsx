"use client";

import React from "react";
import { OrderStatus } from "@/types/order";
import { getOrderStatusLabel, getOrderStatusDescription } from "@/lib/formatters";
import {
  Check,
  Clock,
  ChefHat,
  BellRing,
  Utensils,
  XCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderStatusTimelineProps {
  currentStatus: OrderStatus;
  onSimulateStatusChange?: (nextStatus: OrderStatus) => void;
}

const STEPS: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: "NEW", label: "جديد", icon: Clock },
  { status: "CONFIRMED", label: "تم التأكيد", icon: Check },
  { status: "PREPARING", label: "قيد التحضير", icon: ChefHat },
  { status: "READY", label: "جاهز للتقديم", icon: BellRing },
  { status: "SERVED", label: "تم التقديم", icon: Utensils },
];

export const OrderStatusTimeline: React.FC<OrderStatusTimelineProps> = ({
  currentStatus,
  onSimulateStatusChange,
}) => {
  if (currentStatus === "CANCELLED") {
    return (
      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3">
        <XCircle className="w-8 h-8 text-rose-600 flex-shrink-0" />
        <div>
          <h4 className="font-bold text-sm">تم إلغاء هذا الطلب</h4>
          <p className="text-xs text-rose-700 mt-0.5">
            يرجى مراجعة موظف الصالة أو الكاشير للمساعدة.
          </p>
        </div>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.status === currentStatus);

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-sm space-y-5">
      {/* Current Status Highlight Card */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-forest-900 text-cream-50">
        <div>
          <div className="text-[11px] text-cream-300 font-medium">حالة الطلب الحالية</div>
          <div className="text-base font-bold text-white mt-0.5">
            {getOrderStatusLabel(currentStatus)}
          </div>
          <p className="text-xs text-cream-200/90 mt-1">
            {getOrderStatusDescription(currentStatus)}
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-forest-800 border border-forest-700 flex items-center justify-center text-cream-100 flex-shrink-0">
          {currentIndex === 2 ? (
            <ChefHat className="w-6 h-6 animate-bounce text-gold-400" />
          ) : currentIndex === 3 ? (
            <BellRing className="w-6 h-6 animate-pulse text-gold-300" />
          ) : (
            <Clock className="w-6 h-6 text-cream-200" />
          )}
        </div>
      </div>

      {/* Progress Stepper Timeline */}
      <div className="relative pt-2 pb-1" dir="rtl">
        <div className="grid grid-cols-5 gap-1 relative">
          {/* Connecting line behind icons */}
          <div className="absolute top-4 left-6 right-6 h-0.5 bg-stone-200 -z-0" />
          <div
            className="absolute top-4 right-6 h-0.5 bg-forest-700 -z-0 transition-all duration-500"
            style={{
              width: `${(Math.max(0, currentIndex) / (STEPS.length - 1)) * 90}%`,
            }}
          />

          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const isUpcoming = idx > currentIndex;

            return (
              <div
                key={step.status}
                className="flex flex-col items-center text-center relative z-10"
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2",
                    isCompleted && "bg-forest-800 border-forest-800 text-white shadow-sm",
                    isCurrent &&
                      "bg-white border-forest-800 text-forest-800 ring-4 ring-forest-100 shadow-soft scale-110",
                    isUpcoming && "bg-stone-50 border-stone-300 text-stone-400"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] sm:text-xs font-bold mt-2 leading-tight",
                    isCurrent && "text-forest-900 font-extrabold",
                    isCompleted && "text-stone-700",
                    isUpcoming && "text-stone-400"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Demo Status Controller for Owners / Reviewers */}
      {onSimulateStatusChange && (
        <div className="pt-3 border-t border-stone-100">
          <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-gold-600" />
            <span className="font-semibold text-stone-700">
              أدوات محاكاة تجربة المطعم (للعرض التوضيحي):
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STEPS.map((s, idx) => {
              const isCurrent = currentStatus === s.status;
              const isNext = idx === currentIndex + 1;
              const isPast = idx < currentIndex;
              const isFutureUnreachable = idx > currentIndex + 1;
              const isDisabled = isCurrent || isPast || isFutureUnreachable || currentStatus === "SERVED";

              return (
                <button
                  key={s.status}
                  onClick={() => !isDisabled && onSimulateStatusChange(s.status)}
                  disabled={isDisabled}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                    isCurrent && "bg-forest-800 text-white border-forest-800 cursor-default",
                    isNext && "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 font-bold shadow-xs",
                    isPast && "bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed opacity-60",
                    isFutureUnreachable && "bg-stone-50 text-stone-300 border-stone-100 cursor-not-allowed opacity-40"
                  )}
                  title={
                    isCurrent
                      ? "الحالة الحالية"
                      : isNext
                      ? `الانتقال إلى: ${s.label}`
                      : "غير متاح وفق تسلسل مراحل التحضير"
                  }
                >
                  {s.label}
                  {isCurrent && " ✓"}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-stone-400 mt-2">
            💡 ملاحظة: في بيئة العمل الحقيقية، تتحدث هذه الحالات تلقائياً عبر شاشة الكاشير والمطبخ (Dashboard) فور اتخاذ الإجراء.
          </p>
        </div>
      )}
    </div>
  );
};
