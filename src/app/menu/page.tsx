import { AdminLayout } from "@/components/layout/admin-layout";
import { MenuManagement } from "@/features/menu/menu-management";

export default function MenuPage() {
  return (
    <AdminLayout
      pageTitle="إدارة قائمة الطعام والمنتجات"
      pageSubtitle="إدارة الأصناف، وتحديث الأسعار، وتصنيف المأكولات، ومجموعات الإضافات"
    >
      <MenuManagement />
    </AdminLayout>
  );
}
