import { RequestDetail } from "@/components/requests/RequestDetail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SolicitudPage({ params }: Props) {
  const { id } = await params;
  return <RequestDetail requestId={id} />;
}
