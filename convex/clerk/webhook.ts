import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import { constantTimeCompare } from "../crawl/utils";

function getAuthToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function checkWebhookMethod(request: Request): Response | null {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  return null;
}

function getExpectedWebhookToken(): string {
  const token = process.env.CLERK_WEBHOOK_SECRET || "";
  // Reject whitespace-only tokens — they pass truthiness checks but are not valid secrets
  if (token.trim().length === 0 && token.length > 0) {
    console.error("Webhook secret is whitespace-only — rejecting as invalid configuration");
    return "";
  }
  return token;
}

function authenticateWebhook(request: Request): Response | null {
  const token = getAuthToken(request);
  const expected = getExpectedWebhookToken();
  if (!expected) {
    console.error("No auth token configured for user webhook");
    return new Response("Server configuration error", { status: 500 });
  }
  if (!token || !constantTimeCompare(token, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

function parseWebhookPayloadSafe(
  rawBody: string,
): { type: string; data: Record<string, unknown> } | Response {
  try {
    return JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
}

function extractWebhookEmail(data: Record<string, unknown>): string {
  const addresses = data.email_addresses as Array<{ email_address: string }> | undefined;
  return addresses?.[0]?.email_address ?? "";
}

async function handleUserCreatedOrUpdated(ctx: any, data: Record<string, unknown>): Promise<void> {
  const clerkId = data.id as string;
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || "Unknown";
  const email = extractWebhookEmail(data);
  const imageUrl = data.image_url as string | undefined;

  // Never trust publicMetadata.role from Clerk — roles must only be set via admin mutations
  await ctx.runMutation(internal.users.upsertFromWebhook, {
    clerkId,
    name,
    email,
    imageUrl,
  });
}

async function handleUserDeleted(ctx: any, data: Record<string, unknown>): Promise<void> {
  const clerkId = data.id as string;
  await ctx.runMutation(internal.users.deleteFromWebhook, {
    clerkId,
  });
}

function okResponse(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function dispatchWebhookEvent(
  ctx: any,
  type: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (type === "user.created" || type === "user.updated") {
    await handleUserCreatedOrUpdated(ctx, data);
  }
  if (type === "user.deleted") {
    await handleUserDeleted(ctx, data);
  }
}

export const userWebhook = httpAction(async (ctx, request) => {
  const methodErr = checkWebhookMethod(request);
  if (methodErr) return methodErr;

  const authErr = authenticateWebhook(request);
  if (authErr) return authErr;

  const rawBody = await request.text();
  const payload = parseWebhookPayloadSafe(rawBody);
  if (payload instanceof Response) return payload;

  await dispatchWebhookEvent(ctx, payload.type, payload.data);

  return okResponse();
});
