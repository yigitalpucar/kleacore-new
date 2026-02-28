import { getProductsBySubType } from "@/lib/dal/products";
import { Content } from "./content";

const Page = async () => {
  const products = await getProductsBySubType("hosting", "wordpress");
  return <Content products={products} />;
};

export default Page;
