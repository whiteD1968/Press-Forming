import { FormingToolsPage } from "../../../components/ToolAndObservationPages";
import { getResearchAccessState } from "../../../lib/access";

export default async function ToolsIndex() {
  const { state } = await getResearchAccessState();
  return <FormingToolsPage accessState={state} />;
}
