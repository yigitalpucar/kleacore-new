import { getProducts } from "@/lib/dal/products";
import { parsePagination } from "@/lib/utils/pagination";
import { PackagesContent } from "./content";
import type { ProductCategorySlug, ProductStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);

  const categorySlug = sp.kategori as ProductCategorySlug | undefined;
  const status = sp.durum
    ? ((sp.durum as string).toUpperCase() as ProductStatus)
    : undefined;

  const result = await getProducts({
    ...params,
    perPage: 50,
    categorySlug,
    status,
  });

  return (
    <PackagesContent
      data={result.data}
      total={result.total}
      initialCategory={categorySlug || "all"}
    />
  );
}
