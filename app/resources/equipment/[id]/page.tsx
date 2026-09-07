import { EquipmentDetailPage } from "../../../../components/LibraryPages";

export default async function EquipmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EquipmentDetailPage id={id} />;
}
