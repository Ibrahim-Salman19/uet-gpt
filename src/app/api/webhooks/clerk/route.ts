import { headers } from "next/headers";
import { Webhook } from "svix";

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
  try {
    wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  return new Response("ok", { status: 200 });
}
