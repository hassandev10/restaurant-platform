"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import QRCode from "qrcode";
import { formatArabicDateTime, formatCurrency, getTableStatusConfig } from "@/lib/formatters";
import { CONFIG } from "@/lib/config";
import { tablesService } from "@/services/tables-service";
import { RestaurantTable, TableSection, TableStatus } from "@/types/table";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { toast } from "sonner";
import {
  Armchair,
  Check,
  Download,
  Edit2,
  ExternalLink,
  Filter,
  Layers,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  X,
  XCircle,
} from "lucide-react";

export function TablesManagement() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [sections, setSections] = useState<TableSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [isEditTableModalOpen, setIsEditTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [activeQRTable, setActiveQRTable] = useState<RestaurantTable | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Add Table Form State
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newCapacity, setNewCapacity] = useState(4);
  const [newSectionId, setNewSectionId] = useState("");

  // Edit Table Form State
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editCapacity, setEditCapacity] = useState(4);
  const [editSectionId, setEditSectionId] = useState("");
  const [editStatus, setEditStatus] = useState<TableStatus>("AVAILABLE");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadTablesAndSections = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tablesResp, sectionsList] = await Promise.all([
        tablesService.listTables({ pageSize: 100 }),
        tablesService.listSections().catch(() => [] as TableSection[]),
      ]);
      setTables(tablesResp.tables || []);
      setSections(sectionsList || []);
      if (sectionsList && sectionsList.length > 0 && !newSectionId) {
        setNewSectionId(sectionsList[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل استرجاع بيانات الطاولات";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTablesAndSections();
  }, []);

  // Filtered Tables
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesSection = sectionFilter === "all" || t.sectionId === sectionFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        t.tableNumber.toLowerCase().includes(q) ||
        (t.displayName && t.displayName.toLowerCase().includes(q)) ||
        (t.sectionName && t.sectionName.toLowerCase().includes(q));

      return matchesStatus && matchesSection && matchesSearch;
    });
  }, [tables, statusFilter, sectionFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = tables.length;
    const available = tables.filter((t) => t.status === "AVAILABLE").length;
    const occupied = tables.filter((t) => t.status === "OCCUPIED").length;
    const cleaning = tables.filter((t) => t.status === "CLEANING").length;
    const outOfService = tables.filter((t) => t.status === "OUT_OF_SERVICE").length;
    const totalCapacity = tables.reduce((sum, t) => sum + (t.capacity || 0), 0);

    return { total, available, occupied, cleaning, outOfService, totalCapacity };
  }, [tables]);

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber.trim()) {
      toast.error("يرجى إدخال رقم الطاولة (مثال: T10)");
      return;
    }

    try {
      const created = await tablesService.createTable({
        tableNumber: newTableNumber.trim(),
        displayName: newDisplayName.trim() || `طاولة ${newTableNumber.trim()}`,
        capacity: Number(newCapacity) || 4,
        sectionId: newSectionId || undefined,
      });

      setTables((prev) => [created, ...prev]);
      setIsAddTableModalOpen(false);
      setNewTableNumber("");
      setNewDisplayName("");
      toast.success(`تمت إضافة الطاولة ${created.tableNumber} بنجاح`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر إنشاء الطاولة";
      toast.error(msg);
    }
  };

  const openEditModal = (table: RestaurantTable) => {
    setEditingTable(table);
    setEditDisplayName(table.displayName || table.name || "");
    setEditCapacity(table.capacity || 4);
    setEditSectionId(table.sectionId || "");
    setEditStatus(table.status);
    setIsEditTableModalOpen(true);
  };

  const handleUpdateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;

    try {
      const updated = await tablesService.updateTable(editingTable.id, {
        displayName: editDisplayName.trim() || undefined,
        capacity: Number(editCapacity) || undefined,
        sectionId: editSectionId || undefined,
        status: editStatus,
      });

      setTables((prev) =>
        prev.map((t) => (t.id === editingTable.id ? { ...t, ...updated } : t))
      );
      setIsEditTableModalOpen(false);
      toast.success(`تم تحديث بيانات الطاولة ${updated.tableNumber} بنجاح`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر تحديث الطاولة";
      toast.error(msg);
    }
  };

  const openQRModal = async (table: RestaurantTable) => {
    setActiveQRTable(table);
    setIsQRModalOpen(true);

    try {
      const qrData = await tablesService.getTableQR(table.id);
      const urlToEncode = qrData.customerUrl || `${CONFIG.customerFrontendUrl}/r/${CONFIG.defaultRestaurantSlug}/table?t=${table.token}`;

      const generatedDataUrl = await QRCode.toDataURL(urlToEncode, {
        width: 320,
        margin: 2,
        color: {
          dark: "#1b372a",
          light: "#ffffff",
        },
      });

      setQrDataUrl(generatedDataUrl);
    } catch {
      // Fallback local QR encode
      const fallbackUrl = `${CONFIG.customerFrontendUrl}/r/${CONFIG.defaultRestaurantSlug}/table?t=${table.token}`;
      const fallbackDataUrl = await QRCode.toDataURL(fallbackUrl, { width: 320, margin: 2 });
      setQrDataUrl(fallbackDataUrl);
    }
  };

  const handleRegenerateQR = async () => {
    if (!activeQRTable) return;
    try {
      const regenerated = await tablesService.regenerateQR(activeQRTable.id);
      setTables((prev) =>
        prev.map((t) => (t.id === activeQRTable.id ? { ...t, token: regenerated.token } : t))
      );
      setActiveQRTable((prev) => (prev ? { ...prev, token: regenerated.token } : null));

      const newUrl = regenerated.customerUrl || `${CONFIG.customerFrontendUrl}/r/${CONFIG.defaultRestaurantSlug}/table?t=${regenerated.token}`;
      const newQrDataUrl = await QRCode.toDataURL(newUrl, { width: 320, margin: 2 });
      setQrDataUrl(newQrDataUrl);

      toast.success("تم تجديد رمز الاستجابة السريعة (QR) بنجاح وإلغاء الرمز القديم");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر تجديد رمز QR";
      toast.error(msg);
    }
  };

  const downloadQRImage = () => {
    if (!qrDataUrl || !activeQRTable) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `QR-Table-${activeQRTable.tableNumber}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("تم تنزيل بطاقة الـ QR بنجاح");
  };

  if (isLoading) {
    return <LoadingState message="جاري استرجاع طاولات الصالة من قاعدة البيانات..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadTablesAndSections} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner and Summary */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-stone-900 font-cairo">
              إدارة طاولات وجلسات الصالة
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-forest-50 text-forest-800 font-bold border border-forest-200">
              {tables.length} طاولة
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            متابعة حالة الطاولات، الجلسات المفتوحة، وتوليد وتحميل رموز QR الذكية
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddTableModalOpen(true)}
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-forest-900 hover:bg-forest-800 rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-gold-400" />
            <span>إضافة طاولة جديدة</span>
          </button>
        </div>
      </div>

      {/* Tables Status KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs text-center">
          <span className="text-[11px] font-bold text-stone-500">إجمالي الطاولات</span>
          <div className="text-xl font-black text-stone-900 font-cairo mt-0.5">{stats.total}</div>
        </div>

        <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 shadow-2xs text-center">
          <span className="text-[11px] font-bold text-emerald-800">شاغرة ومتاحة</span>
          <div className="text-xl font-black text-emerald-700 font-cairo mt-0.5">{stats.available}</div>
        </div>

        <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 shadow-2xs text-center">
          <span className="text-[11px] font-bold text-amber-800">مشغولة بزبائن</span>
          <div className="text-xl font-black text-amber-700 font-cairo mt-0.5">{stats.occupied}</div>
        </div>

        <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-200 shadow-2xs text-center">
          <span className="text-[11px] font-bold text-purple-800">قيد التنظيف</span>
          <div className="text-xl font-black text-purple-700 font-cairo mt-0.5">{stats.cleaning}</div>
        </div>

        <div className="bg-stone-100 p-3.5 rounded-xl border border-stone-300 shadow-2xs text-center">
          <span className="text-[11px] font-bold text-stone-600">خارج الخدمة</span>
          <div className="text-xl font-black text-stone-700 font-cairo mt-0.5">{stats.outOfService}</div>
        </div>

        <div className="bg-gold-50/60 p-3.5 rounded-xl border border-gold-200 shadow-2xs text-center">
          <span className="text-[11px] font-bold text-gold-800">السعة الاستيعابية</span>
          <div className="text-xl font-black text-gold-700 font-cairo mt-0.5">{stats.totalCapacity} مقعد</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الطاولة أو اسمها..."
              className="w-full pr-10 pl-3 py-2 text-xs bg-cream-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-cream-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700 text-stone-800"
          >
            <option value="all">كل الحالات ({tables.length})</option>
            <option value="AVAILABLE">شاغرة ومتاحة</option>
            <option value="OCCUPIED">مشغولة بزبائن</option>
            <option value="CLEANING">قيد التنظيف</option>
            <option value="OUT_OF_SERVICE">خارج الخدمة</option>
          </select>

          {/* Section Filter */}
          {sections.length > 0 && (
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-cream-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700 text-stone-800"
            >
              <option value="all">كل الأقسام</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={loadTablesAndSections}
          type="button"
          className="p-2 text-stone-500 hover:text-stone-900 hover:bg-cream-100 rounded-xl border border-stone-200 transition-colors"
          title="تحديث قائمة الطاولات"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tables Grid */}
      {filteredTables.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <Armchair className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="text-stone-800 font-bold font-cairo text-base">لا توجد طاولات مطابقة</h3>
          <p className="text-stone-500 text-xs mt-1">
            جرب إعادة ضبط فلاتر الحالة أو البحث برقم آخر
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTables.map((table) => {
            const statusConfig = getTableStatusConfig(table.status);

            return (
              <div
                key={table.id}
                className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs hover:shadow-card transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Table Header: Number & Status Badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-forest-900 text-gold-400 font-black font-mono text-sm flex items-center justify-center shadow-xs">
                        {table.tableNumber}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-stone-900 font-cairo leading-tight">
                          {table.displayName || table.name || `طاولة ${table.tableNumber}`}
                        </h4>
                        <span className="text-[11px] text-stone-400 font-tajawal">
                          {table.sectionName || "الصالة الرئيسية"}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusConfig.bgClass} ${statusConfig.textClass} ${statusConfig.borderClass}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Table Capacity & Active Session Info */}
                  <div className="space-y-2 py-2 border-t border-b border-stone-100 my-2 text-xs">
                    <div className="flex items-center justify-between text-stone-600">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-stone-400" />
                        <span>السعة القصوى:</span>
                      </span>
                      <span className="font-bold text-stone-800">{table.capacity} أفراد</span>
                    </div>

                    {table.currentSession ? (
                      <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900">
                        <div className="flex items-center justify-between font-bold text-[11px]">
                          <span>جلسة زبائن نشطة</span>
                          <span>منذ {table.currentSession.durationMinutes} دقيقة</span>
                        </div>
                        {table.currentSession.openedByName && (
                          <div className="text-[10px] text-amber-700 mt-0.5">
                            بواسطة: {table.currentSession.openedByName}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-stone-400 py-1">
                        لا توجد جلسة مفتوحة حالياً
                      </div>
                    )}

                    {table.activeOrder && (
                      <div className="flex items-center justify-between text-[11px] font-bold text-forest-800 bg-forest-50 p-2 rounded-xl border border-forest-200">
                        <span>طلب نشط #{table.activeOrder.orderNumber}</span>
                        <span>{formatCurrency(table.activeOrder.total)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Table Footer Actions */}
                <div className="pt-2 flex items-center justify-between gap-2">
                  <button
                    onClick={() => openQRModal(table)}
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-forest-800 bg-forest-50 hover:bg-forest-100 border border-forest-200 transition-colors"
                    title="عرض وتحميل رمز الـ QR للطاولة"
                  >
                    <QrCode className="w-3.5 h-3.5 text-forest-600" />
                    <span>رمز QR</span>
                  </button>

                  <button
                    onClick={() => openEditModal(table)}
                    type="button"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-cream-100 border border-stone-200 transition-colors"
                    title="تعديل خصائص وحالة الطاولة"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Table Modal */}
      {isAddTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 md:p-8">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-6">
              <div>
                <h3 className="text-lg font-bold font-cairo text-stone-900">إضافة طاولة طعام جديدة</h3>
                <p className="text-xs text-stone-500">سيتم حفظ الطاولة وتوليد رمز QR مشفر لها فوراً</p>
              </div>
              <button
                onClick={() => setIsAddTableModalOpen(false)}
                type="button"
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTable} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  رقم الطاولة في الصالة <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  placeholder="مثال: T15 أو VIP-1"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  الاسم المعروض (اختياري)
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="مثال: طاولة عائلية 15"
                  className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    السعة (عدد الكراسي) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(parseInt(e.target.value) || 4)}
                    className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    قسم الصالة
                  </label>
                  <select
                    value={newSectionId}
                    onChange={(e) => setNewSectionId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                  >
                    <option value="">الصالة الرئيسية</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTableModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 bg-cream-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-forest-900 hover:bg-forest-800 rounded-xl shadow-xs"
                >
                  إنشاء وحفظ الطاولة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Table Modal */}
      {isEditTableModalOpen && editingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 md:p-8">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-6">
              <div>
                <h3 className="text-lg font-bold font-cairo text-stone-900">
                  تعديل الطاولة: {editingTable.tableNumber}
                </h3>
                <p className="text-xs text-stone-500">تحديث الحالة التشغيلية أو السعة والقسم</p>
              </div>
              <button
                onClick={() => setIsEditTableModalOpen(false)}
                type="button"
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTable} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  الحالة التشغيلية للطاولة
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TableStatus)}
                  className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                >
                  <option value="AVAILABLE">شاغرة ومتاحة للزبائن (AVAILABLE)</option>
                  <option value="OCCUPIED">مشغولة بزبائن (OCCUPIED)</option>
                  <option value="CLEANING">قيد التنظيف والتعقيم (CLEANING)</option>
                  <option value="OUT_OF_SERVICE">خارج الخدمة مؤقتاً (OUT_OF_SERVICE)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  الاسم المعروض
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    السعة (أفراد)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(parseInt(e.target.value) || 4)}
                    className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    القسم
                  </label>
                  <select
                    value={editSectionId}
                    onChange={(e) => setEditSectionId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 focus:outline-none"
                  >
                    <option value="">الصالة الرئيسية</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditTableModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 bg-cream-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-forest-900 hover:bg-forest-800 rounded-xl shadow-xs"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Preview & Download Modal */}
      {isQRModalOpen && activeQRTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <h3 className="font-bold font-cairo text-base text-stone-900">
                بطاقة رمز QR — طاولة #{activeQRTable.tableNumber}
              </h3>
              <button
                onClick={() => setIsQRModalOpen(false)}
                type="button"
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Card Preview */}
            <div className="bg-cream-50 p-6 rounded-2xl border-2 border-forest-900/10 shadow-xs mb-4">
              <div className="text-center mb-3">
                <h4 className="font-black font-cairo text-lg text-forest-950">مطعم الزيتونة</h4>
                <p className="text-xs text-stone-500 font-medium">امسح الرمز لطلب الطعام مباشرة من طاولتك</p>
              </div>

              <div className="w-56 h-56 mx-auto bg-white p-3 rounded-2xl shadow-sm border border-stone-200 flex items-center justify-center mb-3">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt={`QR Code for Table ${activeQRTable.tableNumber}`} className="w-full h-full" />
                ) : (
                  <div className="text-xs text-stone-400 animate-pulse">جاري إنشاء رمز الـ QR...</div>
                )}
              </div>

              <div className="font-bold text-xs text-stone-700 font-mono">
                طاولة رقم: {activeQRTable.tableNumber} ({activeQRTable.displayName || "صالة"})
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadQRImage}
                type="button"
                className="flex-1 py-2.5 px-4 bg-forest-900 hover:bg-forest-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition"
              >
                <Download className="w-4 h-4 text-gold-400" />
                <span>تحميل بطاقة الـ QR (PNG)</span>
              </button>

              <button
                onClick={handleRegenerateQR}
                type="button"
                className="p-2.5 bg-cream-100 hover:bg-cream-200 text-stone-700 rounded-xl border border-stone-300 transition"
                title="تجديد رمز الـ QR (إلغاء القديم)"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
