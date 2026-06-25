import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractText } from "@/lib/prompt";
import { checkCsrf } from "./csrf";

// Per-message content limit. Applied to both `content` and each `parts[].text`
// so a client cannot bypass the cap by splitting text across many `parts`.
const MAX_MESSAGE_CHARS = 8000;
const MAX_PARTS_PER_MESSAGE = 32;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_MESSAGE_CHARS).optional(),
  parts: z
    .array(z.object({ type: z.string(), text: z.string().max(MAX_MESSAGE_CHARS) }))
    .max(MAX_PARTS_PER_MESSAGE)
    .optional(),
});

const ChatRequestSchema = z
  .object({
    messages: z.array(MessageSchema).min(1),
  })
  .refine((data) => data.messages.every((m) => m.content || (m.parts && m.parts.length > 0)), {
    message: "Each message must have content or parts",
  });

export type ChatMessage = { role: string; content: string };
export type RawMessage = z.infer<typeof MessageSchema>;

export function parseBodyOrError(
  bodyText: string,
): { messages: ChatMessage[]; rawMessages: RawMessage[] } | NextResponse {
  const MAX_BODY = 100 * 1024;
  if (bodyText.length > MAX_BODY) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const messages = parsed.data.messages.map((m) => ({
    role: m.role,
    content: extractText(m as { content?: string; parts?: { type: string; text: string }[] }),
  }));

  // Defense in depth: even with per-field caps, the extracted text (which feeds
  // the LLM prompt) must stay within an overall budget to bound token cost.
  const MAX_TOTAL_CHARS = 32_000;
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  return { messages, rawMessages: parsed.data.messages };
}

export async function validateRequestPhase(
  req: NextRequest,
): Promise<{ messages: ChatMessage[]; question: string } | NextResponse> {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;
  const bodyText = await req.text();
  const bodyOrError = parseBodyOrError(bodyText);
  if (bodyOrError instanceof NextResponse) return bodyOrError;
  const lastMessage = bodyOrError.messages[bodyOrError.messages.length - 1];
  if (lastMessage?.role !== "user" || !lastMessage?.content) {
    return NextResponse.json(
      { error: "Last message must be a user message and have content" },
      { status: 400 },
    );
  }
  return { messages: bodyOrError.messages, question: lastMessage.content };
}
