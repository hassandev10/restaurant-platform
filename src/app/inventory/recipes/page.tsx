import { AdminLayout } from "@/components/layout/admin-layout";
import { RecipesList } from "@/features/inventory/recipes-list";

export default function InventoryRecipesPage() {
  return (
    <AdminLayout
      pageTitle="وصفات قائمة الطعام وجداول المكونات"
      pageSubtitle="ربط أطباق قائمة الطعام بمكونات وخامات المخزون لحساب التكلفة والخصم الآلي"
    >
      <RecipesList />
    </AdminLayout>
  );
}
