import { LibraryEditor } from "../../../../components/LibraryEditor";
import { requireApprovedUser } from "../../../../lib/access";

export default async function NewResearchSource() {
  await requireApprovedUser();
  return <LibraryEditor kind="research" />;
}
