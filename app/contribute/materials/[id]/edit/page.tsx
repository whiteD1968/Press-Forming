import { LibraryEditor } from "../../../../../components/LibraryEditor";

export default async function EditMaterial({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LibraryEditor kind="material" id={id} />;
}
