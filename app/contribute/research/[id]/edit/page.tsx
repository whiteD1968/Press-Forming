import { LibraryEditor } from "../../../../../components/LibraryEditor";

export default async function EditResearchSource({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LibraryEditor kind="research" id={id} />;
}
