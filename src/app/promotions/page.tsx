import { AdminLayout } from "@/components/layout/admin-layout";
import { PromotionsView } from "@/features/promotions/promotions-view";

export default function PromotionsPage() {
  return (
    <AdminLayout
      pageTitle="إدارة العروض الترويجية والخصومات"
      pageSubtitle="عقود ومواصفات واجهات الخصومات والكوبونات وقواعد تطبيقها"
    >
      <PromotionsView />
    </AdminLayout>
  );
}
