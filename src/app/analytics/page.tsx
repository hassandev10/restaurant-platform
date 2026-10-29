import { AdminLayout } from "@/components/layout/admin-layout";
import { AnalyticsView } from "@/features/analytics/analytics-view";

export default function AnalyticsPage() {
  return (
    <AdminLayout
      pageTitle="التحليلات والمؤشرات المالية"
      pageSubtitle="عقود ومواصفات واجهات التقارير التحليلية المتقدمة ونقاط النهاية المطلوبة"
    >
      <AnalyticsView />
    </AdminLayout>
  );
}
