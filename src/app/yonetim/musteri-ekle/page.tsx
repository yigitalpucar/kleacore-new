import type { Metadata } from "next";
import { AddCustomerForm } from "./content";

export const metadata: Metadata = { title: "Müşteri ekle" };

export default function AddCustomerPage() {
  return <AddCustomerForm />;
}
