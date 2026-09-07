import { LibraryEditor } from "../../../../components/LibraryEditor";
import { requireApprovedUser } from "../../../../lib/access";

export default async function NewAtlasEntry() {
  await requireApprovedUser();
  return <LibraryEditor kind="atlas" />;
}
