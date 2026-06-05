import { ChatThreadClient } from "./client";

interface ChatThreadPageProps {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ params }: ChatThreadPageProps) {
  const { threadId } = await params;
  return {
    title: `Chat - ${threadId.slice(0, 8)}…`,
  };
}

export default async function ChatThreadPage({ params, searchParams }: ChatThreadPageProps) {
  const { threadId } = await params;
  const { q } = await searchParams;
  return <ChatThreadClient threadId={threadId} initialMessage={q} />;
}
