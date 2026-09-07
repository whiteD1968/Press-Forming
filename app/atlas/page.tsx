import { atlasGroups } from "../../lib/research";
import { DynamicAtlasPage } from "../../components/LibraryPages";
import { getResearchAccessState, isApprovedState } from "../../lib/access";

export const dynamic = "force-dynamic";

export default async function AtlasPage() {
  const { state } = await getResearchAccessState();
  return <DynamicAtlasPage fallback={atlasGroups} accessState={state} allowFallback={isApprovedState(state)} />;
}
