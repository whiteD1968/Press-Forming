import { ProductsPage } from "../../../components/LibraryPages";
import { getResearchAccessState } from "../../../lib/access";

export const dynamic = "force-dynamic";

export default async function ProductsIndex() {
  const { state } = await getResearchAccessState();
  return <ProductsPage accessState={state} />;
}
