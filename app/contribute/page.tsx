import { ContributePage } from "../../components/LibraryPages";
import { requireApprovedUser } from "../../lib/access";

export default async function Contribute() {
  await requireApprovedUser();
  return <ContributePage />;
}
