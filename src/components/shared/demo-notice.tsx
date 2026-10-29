import React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DemoNoticeProps {
  className?: string;
  variant?: "banner" | "inline";
}

export const DemoNotice: React.FC<DemoNoticeProps> = ({
  className,
  variant = "inline",
}) => {
  if (variant === "banner") {
    return (
      <div className={cn("bg-amber-50/90 border-b border-amber-200/80 px-4 py-2 text-xs text-amber-900 flex items-center justify-center gap-2 text-center", className)}>
        <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-700" />
        <span>
          <strong>نسخة تجريبية للعميل:</strong> يتم حفظ الطلبات محليًا للتجربة • الدفع عند الكاشير داخل المطعم
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl bg-amber-50/70 border border-amber-200/60 p-3 text-xs text-amber-900 flex items-start gap-2.5",
        className
      )}
    >
      <Info className="w-4 h-4 flex-shrink-0 text-amber-700 mt-0.5" />
      <div className="space-y-0.5 leading-normal">
        <p className="font-semibold text-amber-950">تنويه المحاكاة التجريبية</p>
        <p className="text-amber-800">
          هذا الطلب مسجل كبيان تجريبي في بيئة العميل. الدفع وتأكيد الحساب الفعلي يتم عند الكاشير داخل صالة المطعم.
        </p>
      </div>
    </div>
  );
};
