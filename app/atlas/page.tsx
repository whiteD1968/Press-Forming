import { atlasGroups } from "../../lib/research";
import { DynamicAtlasPage } from "../../components/LibraryPages";
import { requireApprovedUser } from "../../lib/access";

export default async function AtlasPage() {
  await requireApprovedUser();
  return <DynamicAtlasPage fallback={atlasGroups} />;
}
