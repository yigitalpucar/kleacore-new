import type { Metadata } from "next";
import { NewPackageContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const metadata: Metadata = { title: "Yeni paket" };

export default async function NewPackagePage() {
  await requirePermission("products.manage");
  return <NewPackageContent />;
}
