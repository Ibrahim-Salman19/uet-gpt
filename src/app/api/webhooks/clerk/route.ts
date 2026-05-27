import { ConvexHttpClient } from "convex/browser";
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

  const { type, data } = evt;

  if (type === "user.created" || type === "user.updated") {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      console.warn("Missing NEXT_PUBLIC_CONVEX_URL, skipping Convex mutation");
      return new Response("ok", { status: 200 });
    }

    const clerkId = data.id as string;
    const firstName = (data.first_name as string) ?? "";
    const lastName = (data.last_name as string) ?? "";
    const name = [firstName, lastName].filter(Boolean).join(" ").trim() || "Unknown";
    const emailAddresses = data.email_addresses as Array<{ email_address: string }> | undefined;
    const email = emailAddresses?.[0]?.email_address ?? "";
    const imageUrl = data.image_url as string | undefined;

    const client = new ConvexHttpClient(convexUrl);
    await (client.mutation as unknown as (name: string, args: object) => Promise<unknown>)(
      "users:getOrCreate",
      {
        clerkId,
        name,
        email,
        imageUrl: imageUrl || undefined,
        secret,
      },
    );
  }

  return new Response("ok", { status: 200 });
}
