import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getInstanceFormView } from "@/lib/modules/admin-view";
import { ModuleInstanceForm } from "../instance-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Modül örneği" };

export default async function ModuleInstancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getInstanceFormView(id);
  if (!view) return notFound();
  return <ModuleInstanceForm view={view} />;
}
