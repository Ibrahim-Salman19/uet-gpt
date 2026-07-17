import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { httpAction } from "../_generated/server";
import { constantTimeCompare } from "../crawl/utils";

function getAuthToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

// Per-delivery idempotency key. Clerk/svix deliveries are at-least-once and can
// arrive out of order; the upstream Next.js route forwards svix's unique message
// id so replays of the same delivery can be detected and dropped. Falls back to
// the non-prefixed `webhook-id` header for resilience. Returns null when no key
// is available (dedup is then skipped - never blocks a legitimate delivery).
function getIdempotencyKey(request: Request): string | null {
  const id =
    request.headers.get("svix-id") ??
    request.headers.get("webhook-id") ??
    request.headers.get("x-webhook-id");
  return id && id.length > 0 ? id : null;
}

function checkWebhookMethod(request: Request): Response | null {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  return null;
}

function getExpectedWebhookToken(): string {
  const token = process.env.CLERK_WEBHOOK_SECRET || "";
  // Reject whitespace-only tokens - they pass truthiness checks but are not valid secrets
  if (token.trim().length === 0 && token.length > 0) {
    console.error("Webhook secret is whitespace-only - rejecting as invalid configuration");
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  // Runtime shape validation - never trust the parsed body's type.
  // A malformed/forged-but-authorized payload must be rejected, not coerced
  // via `as` casts into the users table.
  if (typeof parsed !== "object" || parsed === null) {
    return new Response("Invalid webhook payload", { status: 400 });
  }
  const candidate = parsed as { type?: unknown; data?: unknown };
  if (typeof candidate.type !== "string" || candidate.type.length === 0) {
    return new Response("Invalid webhook payload: missing 'type'", { status: 400 });
  }
  if (typeof candidate.data !== "object" || candidate.data === null) {
    return new Response("Invalid webhook payload: missing 'data'", { status: 400 });
  }
  return { type: candidate.type, data: candidate.data as Record<string, unknown> };
}

function extractWebhookEmail(data: Record<string, unknown>): string {
  const addresses = data.email_addresses;
  if (!Array.isArray(addresses)) return "";
  const first = addresses[0] as { email_address?: unknown } | undefined;
  return typeof first?.email_address === "string" ? first.email_address : "";
}

// Validate the Clerk user id before it reaches the users table - a missing or
// non-string `id` must never be coerced via `as string` into a corrupt row.
function extractClerkId(data: Record<string, unknown>): string | null {
  const id = data.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

async function handleUserCreatedOrUpdated(
  ctx: ActionCtx,
  data: Record<string, unknown>,
): Promise<boolean> {
  const clerkId = extractClerkId(data);
  if (!clerkId) return false;
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || "Unknown";
  const email = extractWebhookEmail(data);
  const imageUrl = asOptionalString(data.image_url);

  // Never trust publicMetadata.role from Clerk - roles must only be set via admin mutations
  await ctx.runMutation(internal.users.upsertFromWebhook, {
    clerkId,
    name,
    email,
    imageUrl,
  });
  return true;
}

async function handleUserDeleted(ctx: ActionCtx, data: Record<string, unknown>): Promise<boolean> {
  const clerkId = extractClerkId(data);
  if (!clerkId) return false;
  await ctx.runMutation(internal.users.deleteFromWebhook, {
    clerkId,
  });
  return true;
}

function okResponse(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Returns true if the event was dispatched (or intentionally ignored),
// false if the payload was malformed and should be rejected with 400.
async function dispatchWebhookEvent(
  ctx: ActionCtx,
  type: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  if (type === "user.created" || type === "user.updated") {
    return await handleUserCreatedOrUpdated(ctx, data);
  }
  if (type === "user.deleted") {
    return await handleUserDeleted(ctx, data);
  }
  // Unhandled event types are acknowledged as no-ops.
  return true;
}

const MAX_BODY_BYTES = 1_048_576; // 1MB

function checkPayloadSize(request: Request): Response | null {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    console.warn(`Clerk Webhook payload too large (content-length): ${contentLength} bytes`);
    return new Response("Payload too large", { status: 413 });
  }
  return null;
}

async function readBodyWithSizeCheck(request: Request): Promise<string | Response> {
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_BYTES) {
    console.warn(`Clerk Webhook payload too large (actual): ${buffer.byteLength} bytes`);
    return new Response("Payload too large", { status: 413 });
  }
  return new TextDecoder().decode(buffer);
}

export const userWebhook = httpAction(async (ctx, request) => {
  const methodErr = checkWebhookMethod(request);
  if (methodErr) return methodErr;

  const authErr = authenticateWebhook(request);
  if (authErr) return authErr;

  const sizeErr = checkPayloadSize(request);
  if (sizeErr) return sizeErr;

  const rawBody = await readBodyWithSizeCheck(request);
  if (rawBody instanceof Response) return rawBody;

  const payload = parseWebhookPayloadSafe(rawBody);
  if (payload instanceof Response) return payload;

  // Idempotency: drop replays of an already-processed delivery (svix is
  // at-least-once). markWebhookProcessed atomically inserts the dedup row and
  // returns false if it already existed. When no idempotency key is forwarded we
  // skip dedup rather than block delivery.
  const idempotencyKey = getIdempotencyKey(request);
  if (idempotencyKey) {
    const isNew = await ctx.runMutation(internal.crawl.mutations.markWebhookProcessed, {
      jobId: `clerk:${idempotencyKey}`,
    });
    if (!isNew) {
      // Already processed - acknowledge so Clerk stops retrying.
      return okResponse();
    }
  }

  try {
    const dispatched = await dispatchWebhookEvent(ctx, payload.type, payload.data);
    if (!dispatched) {
      // Validation failure: roll back the dedup marker so a corrected retry reprocesses.
      if (idempotencyKey) {
        await ctx.runMutation(internal.crawl.mutations.unmarkWebhookProcessed, {
          jobId: `clerk:${idempotencyKey}`,
        });
      }
      return new Response("Invalid webhook payload: missing user id", { status: 400 });
    }
  } catch (err) {
    // Processing threw (e.g. OCC conflict, cascade-delete failure). Roll back the
    // dedup marker (best-effort) and re-throw so Clerk receives a 5xx and retries -
    // otherwise the already-committed marker turns the retry into a silent no-op and
    // the user.created/updated/deleted event is permanently dropped.
    if (idempotencyKey) {
      try {
        await ctx.runMutation(internal.crawl.mutations.unmarkWebhookProcessed, {
          jobId: `clerk:${idempotencyKey}`,
        });
      } catch (cleanupErr) {
        console.error("Failed to roll back webhook idempotency marker", cleanupErr);
      }
    }
    throw err;
  }

  return okResponse();
});
