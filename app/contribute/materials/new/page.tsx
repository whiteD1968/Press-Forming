import { LibraryEditor } from "../../../../components/LibraryEditor";
import { requireApprovedUser } from "../../../../lib/access";

export default async function NewMaterial() {
  await requireApprovedUser();
  return <LibraryEditor kind="material" />;
}
