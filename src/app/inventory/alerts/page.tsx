import { AdminLayout } from "@/components/layout/admin-layout";
import { AlertsView } from "@/features/inventory/alerts-view";

export default function InventoryAlertsPage() {
  return (
    <AdminLayout
      pageTitle="تنبيهات المخزون والأرصدة الحرجة"
      pageSubtitle="متابعة الأصناف التي اقتربت من النفاد أو نفدت تماماً وإدارة التجاوزات"
    >
      <AlertsView />
    </AdminLayout>
  );
}
