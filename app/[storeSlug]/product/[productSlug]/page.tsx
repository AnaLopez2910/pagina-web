import { permanentRedirect } from "next/navigation";

import { productPath } from "@/lib/product-url";

type Params = Promise<{ storeSlug: string; productSlug: string }>;

// Product pages used to live under the store slug; the new page also resolves their old slugs.
export default async function LegacyProductPage({ params }: { params: Params }) {
  const { productSlug } = await params;
  permanentRedirect(productPath(productSlug));
}
