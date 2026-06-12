import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";

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
  // Use a dedicated Clerk webhook secret instead of falling back to CRAWL_WEBHOOK_SECRET
  return process.env.CLERK_WEBHOOK_SECRET || process.env.CONVEX_AUTH_TOKEN || "";
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
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

  // Sync publicMetadata.role from Clerk → Convex users.role
  const publicMetadata = data.public_metadata as Record<string, unknown> | undefined;
  const validRoles = ["user", "admin", "superadmin"] as const;
  const roleFromMetadata = publicMetadata?.role;
  const role =
    typeof roleFromMetadata === "string" &&
    validRoles.includes(roleFromMetadata.toLowerCase().trim() as (typeof validRoles)[number])
      ? (roleFromMetadata.toLowerCase().trim() as (typeof validRoles)[number])
      : "user";

  await ctx.runMutation(internal.users.upsertFromWebhook, {
    clerkId,
    name,
    email,
    imageUrl,
    role,
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
