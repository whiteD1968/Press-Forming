import { MyWorkPage } from "../../components/LibraryPages";
import { requireApprovedUser } from "../../lib/access";

export default async function MyWork() {
  await requireApprovedUser();
  return <MyWorkPage />;
}
