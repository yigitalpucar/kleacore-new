import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getServiceById } from "@/lib/dal/services";
import { listEmailAccountsForService } from "@/lib/actions/customer/email-accounts";
import { ServiceEpostaContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "E-posta hesapları" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ServiceEpostaPage(props: Props) {
  const params = await props.params;
  const session = await auth();
  const service = await getServiceById(params.id);

  if (!service || service.customerId !== session!.user.id) {
    notFound();
  }

  const categorySlug = service.product.category?.slug?.toLowerCase() ?? "";
  if (categorySlug !== "hosting") {
    redirect(`/musteri/panel/hizmetlerim/${params.id}`);
  }

  if (!service.domain?.trim()) {
    notFound();
  }

  const accountsResult = await listEmailAccountsForService(params.id);
  const accounts = accountsResult.success ? accountsResult.data ?? [] : [];

  return (
    <ServiceEpostaContent
      serviceId={service.id}
      serviceName={service.product.name}
      serviceDomain={service.domain.trim().toLowerCase()}
      accounts={accounts}
    />
  );
}