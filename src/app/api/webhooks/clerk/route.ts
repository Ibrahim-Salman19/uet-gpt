// fallow-ignore-file security-sink
import { headers } from "next/headers";
import { Webhook } from "svix";

function convexSiteUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return url.replace(/\.cloud$/, ".site");
}

async function forwardWebhookToConvex(evt: { type: string; data: Record<string, unknown> }): Promise<Response> {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn("Missing WEBHOOK_SECRET, skipping Convex sync");
    return new Response("ok", { status: 200 });
  }

  const siteUrl = convexSiteUrl();
  if (!siteUrl) {
    console.warn("Missing NEXT_PUBLIC_CONVEX_URL, skipping Convex sync");
    return new Response("ok", { status: 200 });
  }

  const response = await fetch(`${siteUrl}/api/webhook/clerk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${webhookSecret}`,
    },
    body: JSON.stringify(evt),
  });

  if (!response.ok) {
    console.error("User webhook sync failed:", response.status, await response.text());
    return new Response("Convex sync failed", { status: 502 });
  }

  return new Response("ok", { status: 200 });
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_SIGNING_SECRET;
  if (!secret) {
    return new Response("Missing CLERK_SIGNING_SECRET", { status: 500 });
  }

  const payload = await req.text();
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  const wh = new Webhook(secret);
  let evt: { type: string; data: Record<string, unknown> };
  try {
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof evt;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  return await forwardWebhookToConvex(evt);
}
