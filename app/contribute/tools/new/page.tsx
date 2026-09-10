import { requireApprovedUser } from "../../../../lib/access";
import { FormingToolEditor } from "../../../../components/ToolAndObservationPages";

export default async function NewTool() {
  await requireApprovedUser();
  return <FormingToolEditor />;
}
