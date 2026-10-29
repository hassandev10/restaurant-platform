import { AdminLayout } from "@/components/layout/admin-layout";
import { ItemsList } from "@/features/inventory/items-list";

export default function InventoryItemsPage() {
  return (
    <AdminLayout
      pageTitle="أصناف المخزون والخامات"
      pageSubtitle="إدارة المواد الأولية والمنتجات تامة الصنع ووحدات القياس وحدود الأمان"
    >
      <ItemsList />
    </AdminLayout>
  );
}
