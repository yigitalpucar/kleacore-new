import type { Metadata } from "next";
import { NewPackageContent } from "./content";

export const metadata: Metadata = { title: "Yeni paket" };

export default function NewPackagePage() {
  return <NewPackageContent />;
}
