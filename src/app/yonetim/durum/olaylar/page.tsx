import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/utils/auth-helpers";

export default async function OlaylarIndex() {
  await requirePermission("status.manage");
  redirect("/yonetim/durum");
}
