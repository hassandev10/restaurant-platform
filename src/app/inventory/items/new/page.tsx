import { AdminLayout } from "@/components/layout/admin-layout";
import { ItemForm } from "@/features/inventory/item-form";

export default function NewInventoryItemPage() {
  return (
    <AdminLayout
      pageTitle="إضافة صنف مخزون جديد"
      pageSubtitle="تسجيل مادة خام جديدة أو منتج تام الصنع وتحديد معايير التحويل والحد الأدنى"
    >
      <ItemForm />
    </AdminLayout>
  );
}
