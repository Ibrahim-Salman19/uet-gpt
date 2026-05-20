"use client";

import { useEffect, useState } from "react";
import type { ChatMessage, Id, Source } from "@/lib/types";

const mockSources: Source[] = [
  {
    documentId: "doc1" as unknown as Id<"documents">,
    chunkId: "chunk1" as unknown as Id<"chunks">,
    url: "https://web.uettaxila.edu.pk/admissions",
    title: "Admission Guidelines",
    relevanceScore: 0.95,
    excerpt: "Application process for undergraduate programs...",
  },
];

const mockMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "How do I apply for admission to UET Taxila?",
  },
  {
    id: "m2",
    role: "assistant",
    content:
      "To apply for admission to UET Taxila, you need to:\n\n1. **Check Eligibility** - Ensure you meet the minimum 60% marks requirement in FSc/Equivalent\n2. **Register Online** - Visit the UET admissions portal during the application window\n3. **Submit Documents** - Upload your academic transcripts, CNIC/B-Form, and photographs\n4. **Pay Application Fee** - Submit the fee via bank challan or online transfer\n5. **Appear for Entry Test** - Take the UET entry test (usually held in July-August)\n\nThe admission process typically opens in June and closes in August each year.",
    sources: mockSources,
    tokenCount: { prompt: 45, completion: 120, total: 165 },
  },
];

export function useMessages(threadId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(() => {
      setMessages(mockMessages);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [threadId]);

  return {
    messages,
    isLoading,
    setMessages,
  };
}
