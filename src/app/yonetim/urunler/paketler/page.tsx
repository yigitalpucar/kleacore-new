import type { Metadata } from "next";
import { getProducts } from "@/lib/dal/products";
import { parsePagination } from "@/lib/utils/pagination";
import { PackagesContent } from "./content";
import type { ProductCategorySlug, ProductStatus } from "@prisma/client";
import { serializeMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Paketler" };

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
      data={serializeMoney(result.data)}
      total={result.total}
      initialCategory={categorySlug || "all"}
    />
  );
}
