import type { Metadata } from "next";
import { isAutomatedDomainTransferAvailable } from "@/lib/actions/customer/domain-transfer";
import { getDomainTlds } from "@/lib/dal/domain-tlds";
import { Content } from "./content";

export const dynamic = "force-dynamic";

const description =
  "Alan adınızı EPP/Auth koduyla KLEACORE'a taşıyın. Uzantı bazında transfer ücretleri, adım adım transfer süreci ve sık sorulan sorular.";

export const metadata: Metadata = {
  title: "Domain Transferi",
  description,
  alternates: { canonical: "/domain/transfer" },
  openGraph: { title: "Domain Transferi | KLEACORE", description, url: "/domain/transfer" },
};

export default async function DomainTransferPage() {
  const [transferStatus, tlds] = await Promise.all([isAutomatedDomainTransferAvailable(), getDomainTlds()]);

  return (
    <Content
      isLoggedIn={transferStatus.isLoggedIn}
      isAutomatedTransferAvailable={transferStatus.isAutomatedTransferAvailable}
      tlds={tlds.map((tld) => ({
        ext: tld.ext,
        category: tld.category,
        registerPrice: tld.registerPrice,
        renewPrice: tld.renewPrice,
        transferPrice: tld.transferPrice,
      }))}
    />
  );
}
