import { DateView } from "./DateView";

export default async function DatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DateView id={id} />;
}
