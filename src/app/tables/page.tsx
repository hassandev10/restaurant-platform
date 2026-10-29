import { AdminLayout } from "@/components/layout/admin-layout";
import { TablesManagement } from "@/features/tables/tables-management";

export default function TablesPage() {
  return (
    <AdminLayout
      pageTitle="إدارة طاولات وجلسات المطعم"
      pageSubtitle="متابعة الإشغال اللحظي، وتعديل حالات الطاولات، وتوليد وتحميل رموز QR الذكية"
    >
      <TablesManagement />
    </AdminLayout>
  );
}
