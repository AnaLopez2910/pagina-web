import { notFound, redirect } from "next/navigation";

import { getPublicStore } from "@/lib/catalog-data";

type Params = Promise<{ storeSlug: string }>;

export default async function LegacyStorePage({ params }: { params: Params }) {
  const { storeSlug } = await params;
  const catalog = await getPublicStore(storeSlug);
  if (!catalog) notFound();
  redirect("/");
}
