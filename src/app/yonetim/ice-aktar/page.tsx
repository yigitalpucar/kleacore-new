import type { Metadata } from "next";
import { listImportInstances, listImportRuns } from "@/lib/imports/admin";
import { IceAktarContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "İçe aktarma" };

export default async function IceAktarPage() {
  await requirePermission("imports.run");
  const [instances, runs] = await Promise.all([listImportInstances(), listImportRuns()]);
  return <IceAktarContent instances={instances} runs={runs} />;
}
