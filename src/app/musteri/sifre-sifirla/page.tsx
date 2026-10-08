import type { Metadata } from "next";
import { SifreSifirlaContent } from "./content";

export const metadata: Metadata = {
  title: "Yeni Şifre Belirle",
  description: "KLEACORE hesabınız için yeni bir şifre belirleyin.",
  robots: { index: false, follow: false },
};

export default async function SifreSifirlaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return <SifreSifirlaContent token={token} />;
}
