import { requireApprovedUser } from "../../../../../lib/access";
import { FormingToolEditor } from "../../../../../components/ToolAndObservationPages";

export default async function EditTool({ params }: { params: Promise<{ id: string }> }) {
  await requireApprovedUser();
  const { id } = await params;
  return <FormingToolEditor id={id} />;
}
