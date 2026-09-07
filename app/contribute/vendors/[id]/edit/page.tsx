import { LibraryEditor } from "../../../../../components/LibraryEditor";
import { requireApprovedUser } from "../../../../../lib/access";

export default async function EditVendor({ params }: { params: Promise<{ id: string }> }) {
  await requireApprovedUser();
  const { id } = await params;
  return <LibraryEditor kind="vendor" id={id} />;
}
