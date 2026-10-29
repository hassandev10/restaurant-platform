import React, { useState } from "react";
import { RestaurantTable } from "@/types/table";
import {
  UserPlus,
  X,
  Users,
  Loader2,
} from "lucide-react";

interface TableSessionModalProps {
  table: RestaurantTable | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (guestCount: number) => Promise<void>;
}

export const TableSessionModal: React.FC<TableSessionModalProps> = ({
  table,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [guestCount, setGuestCount] = useState<number>(table?.capacity || 2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !table) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onConfirm(guestCount);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "حدث خطأ أثناء فتح الجلسة");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-cairo animate-in fade-in duration-150">
      <div
        className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-stone-200 overflow-hidden"
        dir="rtl"
      >
        <div className="p-5 bg-forest-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-cream-200">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm">بدء جلسة ضيوف جديدة</h3>
              <p className="text-xs text-cream-200/80">
                {table.name} • {table.sectionNameAr}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              عدد الضيوف الجالسين
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-stone-400">
                <Users className="w-4 h-4" />
              </div>
              <input
                type="number"
                min={1}
                max={table.capacity + 6}
                value={guestCount}
                onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
                className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-stone-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-forest-800/20"
              />
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              سعة الطاولة القياسية: {table.capacity} مقاعد
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="py-2 px-3 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2 px-5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              <span>فتح الجلسة</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
