import { AdminLayout } from "@/components/layout/admin-layout";
import { OrdersOverview } from "@/features/orders/orders-overview";

export default function OrdersPage() {
  return (
    <AdminLayout
      pageTitle="سجل ونظرة عامة للطلبات"
      pageSubtitle="استعراض فواتير الطلبات، والبحث، والتحقق المالي وسجل الأحداث التاريخي"
    >
      <OrdersOverview />
    </AdminLayout>
  );
}
