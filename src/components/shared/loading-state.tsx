import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  subMessage?: string;
}

export function LoadingState({
  message = "جاري تحميل البيانات...",
  subMessage = "يتم جلب البيانات الحالية من خادم الـ API",
}: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center mb-3">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
      <p className="text-stone-800 font-semibold font-cairo text-base">{message}</p>
      {subMessage && <p className="text-stone-500 text-sm mt-1">{subMessage}</p>}
    </div>
  );
}
