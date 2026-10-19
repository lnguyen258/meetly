import JoinEvent from "@/components/join-event";

export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  return <JoinEvent code={code} />;
}
