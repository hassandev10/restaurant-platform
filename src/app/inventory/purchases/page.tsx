import { AdminLayout } from "@/components/layout/admin-layout";
import { PurchasesList } from "@/features/inventory/purchases-list";

export default function InventoryPurchasesPage() {
  return (
    <AdminLayout
      pageTitle="فواتير التوريد واستلام البضائع"
      pageSubtitle="إدارة أذون استلام المشتريات ومراجعة المسودات وتأكيد الإضافة للمخزون"
    >
      <PurchasesList />
    </AdminLayout>
  );
}
