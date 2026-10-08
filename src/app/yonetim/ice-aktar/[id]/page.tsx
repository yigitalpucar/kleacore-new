import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getImportRunView, type ImportRowFilter } from "@/lib/imports/admin";
import { ImportRunContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "İçe aktarma önizlemesi" };

const FILTERS: ImportRowFilter[] = ["all", "ready", "attention", "selected", "done", "failed"];

export default async function ImportRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; filter?: string; q?: string }>;
}) {
  await requirePermission("imports.run");
  const { id } = await params;
  const query = await searchParams;
  const filter = FILTERS.includes(query.filter as ImportRowFilter) ? (query.filter as ImportRowFilter) : "all";
  const page = Number.parseInt(query.page ?? "1", 10);
  const view = await getImportRunView(id, { page: Number.isFinite(page) ? page : 1, filter, q: query.q });
  if (!view) return notFound();
  return <ImportRunContent view={JSON.parse(JSON.stringify(view))} />;
}
