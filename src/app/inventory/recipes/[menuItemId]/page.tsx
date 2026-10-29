import { AdminLayout } from "@/components/layout/admin-layout";
import { RecipeEditor } from "@/features/inventory/recipe-editor";

interface PageProps {
  params: Promise<{ menuItemId: string }>;
}

export default async function RecipeEditorPage({ params }: PageProps) {
  const { menuItemId } = await params;
  return (
    <AdminLayout
      pageTitle="إعداد وصفة الطبق والمكونات"
      pageSubtitle="تحديد كميات الخامات للوجبة الواحدة ومحاكاة الاستهلاك وكفاية الرصيد"
    >
      <RecipeEditor menuItemId={menuItemId} />
    </AdminLayout>
  );
}
