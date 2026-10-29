import { AdminLayout } from "@/components/layout/admin-layout";
import { RestaurantSettings } from "@/features/settings/restaurant-settings";

export default function SettingsPage() {
  return (
    <AdminLayout
      pageTitle="إعدادات وبيانات المطعم"
      pageSubtitle="ضبط الاسم، الشعار، ساعات العمل، حالة استقبال الطلبات، والعنوان"
    >
      <RestaurantSettings />
    </AdminLayout>
  );
}
