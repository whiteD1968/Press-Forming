import { ResourcesPage } from "../../components/LibraryPages";
import { getResearchAccessState } from "../../lib/access";

export default async function ResourcesIndex() {
  const { state } = await getResearchAccessState();
  return <ResourcesPage accessState={state} />;
}
