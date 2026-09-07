import { LibraryEditor } from "../../../../../components/LibraryEditor";

export default async function EditVendor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LibraryEditor kind="vendor" id={id} />;
}
