import { ResourcesPage } from "../../components/LibraryPages";
import { requireApprovedUser } from "../../lib/access";

export default async function ResourcesIndex() {
  await requireApprovedUser();
  return <ResourcesPage />;
}
