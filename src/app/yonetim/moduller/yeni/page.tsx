import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getNewInstanceFormView } from "@/lib/modules/admin-view";
import { ModuleInstanceForm } from "../instance-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Yeni modül örneği" };

export default async function NewModuleInstancePage({ searchParams }: { searchParams: Promise<{ modul?: string }> }) {
  const { modul } = await searchParams;
  const view = modul ? getNewInstanceFormView(modul) : null;
  if (!view) return notFound();
  return <ModuleInstanceForm view={view} />;
}
