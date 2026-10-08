import type { Metadata } from "next";
import { listImportInstances, listImportRuns } from "@/lib/imports/admin";
import { IceAktarContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "İçe aktarma" };

export default async function IceAktarPage() {
  const [instances, runs] = await Promise.all([listImportInstances(), listImportRuns()]);
  return <IceAktarContent instances={instances} runs={runs} />;
}
