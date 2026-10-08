import type { Metadata } from "next";
import { db } from "@/lib/db";
import { NewIpPoolForm } from "./form";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Yeni IP havuzu" };

export default async function NewIpPoolPage() {
  await requirePermission("provisioning.manage");
  const instances = await db.moduleInstance.findMany({
    where: { kind: "server" },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: { id: true, label: true },
  });
  return <NewIpPoolForm instances={instances} />;
}
