import type { Metadata } from "next";
import { ConfirmDataRequest } from "./confirm";

export const metadata: Metadata = {
  title: "KVKK Başvurusu Onayı",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function KvkkDogrulaPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <ConfirmDataRequest token={(Array.isArray(token) ? token[0] : token) ?? ""} />;
}
