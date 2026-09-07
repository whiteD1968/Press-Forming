import { MaterialsPage } from "../../components/LibraryPages";
import { getResearchAccessState } from "../../lib/access";

export const dynamic = "force-dynamic";

export default async function MaterialsIndex() {
  const { state } = await getResearchAccessState();
  return <MaterialsPage accessState={state} />;
}
