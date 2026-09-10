import { FormingToolDetailPage } from "../../../../components/ToolAndObservationPages";

export default async function ToolDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormingToolDetailPage id={id} />;
}
