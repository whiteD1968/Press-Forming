import { EquipmentPage } from "../../../components/LibraryPages";
import { getResearchAccessState } from "../../../lib/access";

export const dynamic = "force-dynamic";

export default async function EquipmentIndex() {
  const { state } = await getResearchAccessState();
  return <EquipmentPage accessState={state} />;
}
