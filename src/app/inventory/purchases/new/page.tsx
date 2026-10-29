import { AdminLayout } from "@/components/layout/admin-layout";
import { PurchaseForm } from "@/features/inventory/purchase-form";

interface PageProps {
  searchParams: Promise<{ itemId?: string }>;
}

export default async function NewPurchaseReceiptPage({ searchParams }: PageProps) {
  const { itemId } = await searchParams;
  return (
    <AdminLayout
      pageTitle="تسجيل إذن توريد مشتريات جديد"
      pageSubtitle="إدخال كميات المشتريات بوحدات الشراء واحتساب الإضافة الفعلية للمخزون"
    >
      <PurchaseForm initialItemId={itemId} />
    </AdminLayout>
  );
}
