import { LibraryEditor } from "../../../../components/LibraryEditor";
import { requireApprovedUser } from "../../../../lib/access";

export default async function NewVendor() {
  await requireApprovedUser();
  return <LibraryEditor kind="vendor" />;
}
