import Link from "next/link";
import { UtensilsCrossed, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 font-cairo" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-stone-200 p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-forest-50 border border-forest-200 text-forest-800 flex items-center justify-center mx-auto">
          <UtensilsCrossed className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-extrabold text-stone-900">الصفحة غير موجودة (404)</h1>
        <p className="text-xs text-stone-500">
          الصفحة التي تبحث عنها غير متوفرة أو تم نقلها.
        </p>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest-900 hover:bg-forest-950 text-white text-xs font-bold transition-all shadow-sm"
        >
          <span>العودة لشاشة الطلبات</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
