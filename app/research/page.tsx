import { ResearchLibraryPage } from "../../components/LibraryPages";
import { getResearchAccessState } from "../../lib/access";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const { state } = await getResearchAccessState();
  return <ResearchLibraryPage accessState={state} />;
}
