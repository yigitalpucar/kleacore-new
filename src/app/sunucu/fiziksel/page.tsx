import { getProductsBySubType } from "@/lib/dal/products";
import { Content } from "./content";

export const dynamic = "force-dynamic";

const Page = async () => {
  const products = await getProductsBySubType("server");
  return <Content products={products} />;
};

export default Page;
