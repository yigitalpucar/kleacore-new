import { notFound } from "next/navigation";
import { getProductBySlug, getAddonsByCategory } from "@/lib/dal/products";
import { getProductConfigOptions } from "@/lib/products/configurator";
import { Content } from "./content";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
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

  return <Content product={product} addons={addons} configOptions={configOptions} />;
};

export default Page;
