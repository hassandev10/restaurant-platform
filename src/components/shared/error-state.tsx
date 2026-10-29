import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "تعذر تحميل البيانات",
  message = "حدث خطأ أثناء الاتصال بالخادم. يرجى التحقق من الاتصال وإعادة المحاولة.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center max-w-md mx-auto">
      <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-stone-900 font-bold font-cairo text-lg">{title}</h3>
      <p className="text-stone-600 text-sm mt-1 mb-5">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-forest-800 hover:bg-forest-900 rounded-lg shadow-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>إعادة المحاولة</span>
        </button>
      )}
    </div>
  );
}
