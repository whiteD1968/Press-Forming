import { atlasGroups } from "../../lib/research";
import { DynamicAtlasPage } from "../../components/LibraryPages";

export default function AtlasPage() {
  return <DynamicAtlasPage fallback={atlasGroups} />;
}
