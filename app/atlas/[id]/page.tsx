import { AtlasDetailPage } from "../../../components/LibraryPages";

export default async function AtlasEntryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AtlasDetailPage id={id} />;
}
