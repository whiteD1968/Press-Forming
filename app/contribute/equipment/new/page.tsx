import { LibraryEditor } from "../../../../components/LibraryEditor";
import { requireApprovedUser } from "../../../../lib/access";

export default async function NewEquipment() {
  await requireApprovedUser();
  return <LibraryEditor kind="equipment" />;
}
