import { MaterialDetailPage } from "../../../components/LibraryPages";

export default async function MaterialDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MaterialDetailPage id={id} />;
}
