import { getProductsBySubType } from "@/lib/dal/products";
import { Content } from "./content";

const Page = async () => {
  const products = await getProductsBySubType("ssl", "kurumsal");
  return <Content products={products} />;
};

export default Page;
