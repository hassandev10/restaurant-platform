import React, { useState } from "react";
import { RestaurantTable } from "@/types/table";
import {
  CalendarCheck,
  X,
  User,
  Phone,
  Users,
  Loader2,
} from "lucide-react";

interface TableReservationModalProps {
  table: RestaurantTable | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reservationData: {
    guestName: string;
    guestPhone: string;
    guestCount: number;
    reservedTime: string;
    notes?: string;
  }) => Promise<void>;
}

export const TableReservationModal: React.FC<TableReservationModalProps> = ({
  table,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestCount, setGuestCount] = useState<number>(table?.capacity || 4);
  const [reservedTime, setReservedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !table) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setErrorMsg("يرجى إدخال اسم الضيف صاحب الحجز");
      return;
    }
    if (!guestPhone.trim()) {
      setErrorMsg("يرجى إدخال رقم هاتف الضيف للتواصل");
      return;
    }
    if (!reservedTime) {
      setErrorMsg("يرجى تحديد موعد الحجز");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onConfirm({
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        guestCount,
        reservedTime: new Date(reservedTime).toISOString(),
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "حدث خطأ أثناء تسجيل الحجز");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-cairo animate-in fade-in duration-150">
      <div
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5 bg-forest-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-cream-200">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base">تسجيل حجز جديد</h3>
              <p className="text-xs text-cream-200/80">
                {table.name} • {table.sectionNameAr} (سعة {table.capacity} مقاعد)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {/* Guest Name */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              اسم الضيف *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-stone-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="مثال: أ. محمد عبد الله"
                className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800"
              />
            </div>
          </div>

          {/* Guest Phone */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              رقم الهاتف *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-stone-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                required
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="010xxxxxxxx"
                className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-stone-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800"
                dir="ltr"
              />
            </div>
          </div>

          {/* Row: Guest Count & Reserved Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                عدد الضيوف
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-stone-400">
                  <Users className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  min={1}
                  max={table.capacity + 4}
                  value={guestCount}
                  onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-stone-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-forest-800/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                موعد الحجز *
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  required
                  value={reservedTime}
                  onChange={(e) => setReservedTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-forest-800/20"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              ملاحظات أو طلبات خاصة (اختياري)
            </label>
            <div className="relative">
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: الاحتفال بعيد ميلاد، تزيين الطاولة..."
                className="w-full p-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-forest-800/20 resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="py-2.5 px-4 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2.5 px-6 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>تأكيد الحجز</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
