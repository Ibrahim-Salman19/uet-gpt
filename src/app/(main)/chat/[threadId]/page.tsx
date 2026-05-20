import { ChatThreadClient } from "./client";

interface ChatThreadPageProps {
  params: Promise<{ threadId: string }>;
}

export async function generateMetadata({ params }: ChatThreadPageProps) {
  const { threadId } = await params;
  return {
    title: `Chat - ${threadId.slice(0, 8)}...`,
  };
}

export default async function ChatThreadPage({ params }: ChatThreadPageProps) {
  const { threadId } = await params;
  return <ChatThreadClient threadId={threadId} />;
}
