import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getAddonsByCategory } from "@/lib/dal/products";
import { getProductConfigOptions } from "@/lib/products/configurator";
import { serializeMoney } from "@/lib/money";
import { Content } from "./content";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.category.slug !== "hosting") {
    return { title: "Paket bulunamadı", robots: { index: false } };
  }
  const title = `${product.name} Hosting Paketi Satın Al`;
  const description = `${product.name} hosting paketini yapılandırın: alan adı seçin, ek hizmetleri ekleyin, aylık veya yıllık ödemeyle siparişinizi tamamlayın.`.slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: `/hosting/satin-al/${product.slug}` },
    openGraph: { title: `${title} | KLEACORE`, description, url: `/hosting/satin-al/${product.slug}` },
  };
}

const Page = async ({ params }: PageProps) => {
  const { slug } = await params;

  const product = await getProductBySlug(slug);
  if (!product || product.category.slug !== "hosting") {
    notFound();
  }

  const [addons, configOptions] = await Promise.all([
    getAddonsByCategory("hosting", product.subType || undefined),
    getProductConfigOptions(product.id),
  ]);

  return (
    <Content
      product={serializeMoney(product)}
      addons={serializeMoney(addons)}
      configOptions={configOptions}
    />
  );
};

export default Page;
