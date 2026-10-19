import EventView from "@/components/event-view";

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  return <EventView id={id} />;
}
