import { AdminLayout } from "@/components/layout/admin-layout";
import { DashboardOverview } from "@/features/dashboard/dashboard-overview";

export default function DashboardPage() {
  return (
    <AdminLayout
      pageTitle="لوحة التحكم المركزية"
      pageSubtitle="نظرة شاملة ومؤشرات أداء مباشرة لعمليات المطعم والمبيعات"
    >
      <DashboardOverview />
    </AdminLayout>
  );
}
