import { AdminLayout } from "@/components/layout/admin-layout";
import { ItemDetails } from "@/features/inventory/item-details";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ItemDetailsPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <AdminLayout
      pageTitle="تفاصيل صنف المخزون"
      pageSubtitle="عرض بيانات الصنف، ومعامل التحويل، وسجل الحركات التاريخية للصنف"
    >
      <ItemDetails itemId={id} />
    </AdminLayout>
  );
}
