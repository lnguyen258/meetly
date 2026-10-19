import ChatThread from "@/components/chat-thread";

export default async function ChatThreadPage({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  return <ChatThread id={id} />;
}
