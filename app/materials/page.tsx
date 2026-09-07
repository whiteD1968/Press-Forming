import { MaterialsPage } from "../../components/LibraryPages";
import { requireApprovedUser } from "../../lib/access";

export default async function MaterialsIndex() {
  await requireApprovedUser();
  return <MaterialsPage />;
}
