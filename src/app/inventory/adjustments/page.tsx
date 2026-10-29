import { AdminLayout } from "@/components/layout/admin-layout";
import { AdjustmentsForm } from "@/features/inventory/adjustments-form";

export default function InventoryAdjustmentsPage() {
  return (
    <AdminLayout
      pageTitle="الهدر والاستهلاك والتسويات المخزنية"
      pageSubtitle="تسجيل الهدر، الاستهلاك التشغيلي، ومطابقة فروقات الجرد الفعلي مع الرصيد الدفتري"
    >
      <AdjustmentsForm />
    </AdminLayout>
  );
}
