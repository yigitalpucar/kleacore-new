import type { Metadata } from "next";
import { requireStaff } from "@/lib/utils/auth-helpers";
import AdminForbidden from "../forbidden";

export const metadata: Metadata = { title: "Erişim yetkiniz yok" };

/**
 * Target of the proxy's 403 rewrite (src/lib/auth.config.ts) when a staff
 * member opens a /yonetim route their role cannot access. Pages still call
 * requirePermission themselves (forbidden() → same UI) as the second line.
 */
export default async function YetkisizPage() {
  await requireStaff();
  return <AdminForbidden />;
}
