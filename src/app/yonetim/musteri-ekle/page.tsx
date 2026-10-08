import type { Metadata } from "next";
import { AddCustomerForm } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const metadata: Metadata = { title: "Müşteri ekle" };

export default async function AddCustomerPage() {
  await requirePermission("customers.edit");
  return <AddCustomerForm />;
}
