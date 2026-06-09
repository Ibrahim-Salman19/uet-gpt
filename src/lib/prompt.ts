export function extractText(message: {
  content?: string;
  parts?: { type: string; text: string }[];
}): string {
  if (message.content) return message.content;
  if (message.parts) {
    return message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
  }
  return "";
}

export function buildSystemPrompt(context: string | null, intent: string): string {
  const parts: string[] = ["You are UET GPT, an intelligent assistant for UET Taxila."];

  if (context) {
    parts.push(
      `Here is relevant context from UET Taxila's official sources:\n\n${context}\n\nUse this context to answer the user's question. If the context doesn't contain enough information, say so clearly and provide what you know. Always cite sources when possible.`,
    );
  } else {
    parts.push(
      "You don't have specific context for this question. Answer based on your general knowledge about UET Taxila, but note when you're uncertain.",
    );
  }

  if (intent === "off_topic") {
    parts.push(
      "The user's query appears to be off-topic. Politely redirect them to UET Taxila topics.",
    );
  }

  parts.push(
    "Guidelines:\n- Be concise and accurate\n- Cite sources when using specific information\n- If unsure, acknowledge uncertainty\n- Respond in the same language as the user's query",
  );

  return parts.join("\n\n");
}
