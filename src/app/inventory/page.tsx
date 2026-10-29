import { AdminLayout } from "@/components/layout/admin-layout";
import { InventoryOverview } from "@/features/inventory/inventory-overview";

export default function InventoryPage() {
  return (
    <AdminLayout
      pageTitle="لوحة مؤشرات المخزون"
      pageSubtitle="نظرة عامة على الأرصدة، وقيمة المخزون، والتنبيهات، وآخر الحركات"
    >
      <InventoryOverview />
    </AdminLayout>
  );
}
