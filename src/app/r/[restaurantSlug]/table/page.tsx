import { redirect } from "next/navigation";

interface TableRouteProps {
  params: Promise<{
    restaurantSlug: string;
  }>;
}

export default async function TableRoutePage({ params }: TableRouteProps) {
  const { restaurantSlug } = await params;
  redirect(`/r/${restaurantSlug}`);
}
