import { LibraryEditor } from "../../../../../components/LibraryEditor";

export default async function EditEquipment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LibraryEditor kind="equipment" id={id} />;
}
