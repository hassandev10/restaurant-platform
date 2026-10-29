import { AdminLayout } from "@/components/layout/admin-layout";
import { MovementsLedger } from "@/features/inventory/movements-ledger";

export default function InventoryMovementsPage() {
  return (
    <AdminLayout
      pageTitle="سجل حركات المخزون (Ledger)"
      pageSubtitle="سجل تدقيق كامل وغير قابل للتعديل لجميع عمليات التوريد والصرف والاستهلاك"
    >
      <MovementsLedger />
    </AdminLayout>
  );
}
