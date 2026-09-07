import { ResearchDetailPage } from "../../../components/LibraryPages";

export default async function ResearchDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResearchDetailPage id={id} />;
}
