import { auth } from "@/lib/auth";
import { getServicesByCustomer } from "@/lib/dal/services";
import { YeniDestekContent } from "./content";

export default async function YeniDestekTalebiPage() {
  const session = await auth();
  const services = await getServicesByCustomer(session!.user.id);

  // Servisleri serialize et
  const serializedServices = services.map((service) => ({
    id: service.id,
    label: service.label,
    domain: service.domain,
    productName: service.product.name,
  }));

  return <YeniDestekContent services={serializedServices} />;
}
