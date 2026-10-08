import type { Metadata } from "next";
import { db } from "@/lib/db";
import { NewIpPoolForm } from "./form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Yeni IP havuzu" };

export default async function NewIpPoolPage() {
  const instances = await db.moduleInstance.findMany({
    where: { kind: "server" },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: { id: true, label: true },
  });
  return <NewIpPoolForm instances={instances} />;
}
