import { LibraryEditor } from "../../../../components/LibraryEditor";
import { requireApprovedUser } from "../../../../lib/access";

export default async function NewProduct() {
  await requireApprovedUser();
  return <LibraryEditor kind="product" />;
}
