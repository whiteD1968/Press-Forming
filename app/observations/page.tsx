import { requireApprovedUser } from "../../lib/access";
import { ObservationIndexPage } from "../../components/ToolAndObservationPages";

export default async function ObservationsPage() {
  await requireApprovedUser();
  return <ObservationIndexPage />;
}
