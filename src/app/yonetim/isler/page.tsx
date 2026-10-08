import type { Metadata } from "next";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { getJobsDashboard } from "@/lib/dal/jobs";
import { IslerContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Arka plan işleri" };

export default async function IslerPage() {
  await requireAdmin();
  const dashboard = await getJobsDashboard();
  return <IslerContent {...dashboard} />;
}
