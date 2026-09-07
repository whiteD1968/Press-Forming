import { ResearchLibraryPage } from "../../components/LibraryPages";
import { requireApprovedUser } from "../../lib/access";

export default async function ResearchPage() {
  await requireApprovedUser();
  return <ResearchLibraryPage />;
}
