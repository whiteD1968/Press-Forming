import { ProductDetailPage } from "../../../../components/LibraryPages";

export default async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetailPage id={id} />;
}
