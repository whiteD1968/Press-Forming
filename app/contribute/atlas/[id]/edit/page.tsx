import { LibraryEditor } from "../../../../../components/LibraryEditor";

export default async function EditAtlasEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LibraryEditor kind="atlas" id={id} />;
}
