"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { api } from "convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { revalidatePath } from "next/cache";
import { isAdminRole } from "@/lib/permissions";
import { checkAdminActionRateLimit } from "@/lib/rate-limit";

const VALID_ROLES = ["user", "admin", "superadmin"] as const;
const ROLE_HIERARCHY: Record<string, number> = { user: 0, admin: 1, superadmin: 2 };

export type UserResult = {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
  role: string;
  createdAt: number;
};

async function getAuthenticatedAdmin(): Promise<{ userId: string; role: string } | null> {
  const { userId, getToken } = await auth();
  if (!userId) return null;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  if (user.banned) return null;

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  const convex = new ConvexHttpClient(convexUrl);
  const token = await getToken({ template: "convex" });
  if (token) {
    convex.setAuth(token);
  }

  const convexUser = await convex.query(api.users.getByClerkId, {
    clerkId: userId,
  });

  if (!convexUser || !convexUser.isActive) return null;
  const role = convexUser.role;
  if (!role || !isAdminRole(role)) return null;

  return { userId, role };
}

export async function searchUsers(query: string): Promise<{
  users: UserResult[];
  error?: string;
}> {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return { users: [], error: "Not authorized" };
  }

  if (!query || query.trim().length < 2) {
    return { users: [], error: "Search query must be at least 2 characters" };
  }

  try {
    const client = await clerkClient();
    const result = await client.users.getUserList({
      query: query.trim(),
      limit: 20,
    });

    const users = result.data.map((user) => ({
      id: user.id,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unknown",
      email: user.emailAddresses[0]?.emailAddress ?? "",
      imageUrl: user.imageUrl,
      role: (user.publicMetadata?.role as string) || "user",
      createdAt: user.createdAt,
    }));

    return { users };
  } catch (err) {
    console.error("Failed to search users:", err);
    return { users: [], error: "Failed to search users" };
  }
}

export async function setUserRole(
  userId: string,
  newRole: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return { success: false, error: "Not authorized" };
  }

  if (userId === admin.userId) {
    return {
      success: false,
      error: "Self-demotion is not allowed. You cannot modify your own role.",
    };
  }

  const rateCheck = await checkAdminActionRateLimit(admin.userId);
  if (rateCheck && !rateCheck.success) {
    return { success: false, error: "Rate limit exceeded. Try again later." };
  }

  if (!VALID_ROLES.includes(newRole as (typeof VALID_ROLES)[number])) {
    return { success: false, error: "Invalid role" };
  }

  const newRoleLevel = ROLE_HIERARCHY[newRole as keyof typeof ROLE_HIERARCHY] ?? 0;
  const adminRoleLevel = ROLE_HIERARCHY[admin.role as keyof typeof ROLE_HIERARCHY] ?? 0;
  if (newRoleLevel > adminRoleLevel) {
    return { success: false, error: "Cannot assign a role above your own" };
  }

  try {
    const client = await clerkClient();

    // Guard against modifying a peer/superior: load the target's CURRENT role
    // and reject if it is equal to or above the acting admin's level (mirrors
    // removeUserRole). Without this, an admin could alter another admin or a
    // superadmin.
    const targetUser = await client.users.getUser(userId);
    const targetRole =
      ((targetUser.publicMetadata as Record<string, unknown>)?.role as string) || "user";
    const targetRoleLevel = ROLE_HIERARCHY[targetRole as keyof typeof ROLE_HIERARCHY] ?? 0;
    if (targetRoleLevel >= adminRoleLevel) {
      return {
        success: false,
        error: "Cannot modify a user with a role equal to or above your own",
      };
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    }
    const convex = new ConvexHttpClient(convexUrl);
    const { getToken } = await auth();
    const token = await getToken({ template: "convex" });
    if (token) {
      convex.setAuth(token);
    }

    // Write the authoritative store (Convex) FIRST so the operation fails
    // closed: if Convex rejects (e.g. its own requireAdmin / role guard),
    // Clerk metadata is never mutated and the two stores cannot diverge.
    await convex.mutation(api.users.updateUserRole, {
      clerkId: userId,
      role: newRole as "user" | "admin" | "superadmin",
    });

    // Update Clerk publicMetadata (the derived cache used by edge/middleware)
    // only after the authoritative Convex write succeeds.
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { role: newRole },
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    console.error("Failed to update user role:", err);
    return { success: false, error: "Failed to update user role" };
  }
}

export async function removeUserRole(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return { success: false, error: "Not authorized" };
  }

  if (userId === admin.userId) {
    return {
      success: false,
      error: "Self-demotion is not allowed. You cannot modify your own role.",
    };
  }

  const rateCheck = await checkAdminActionRateLimit(admin.userId);
  if (rateCheck && !rateCheck.success) {
    return { success: false, error: "Rate limit exceeded. Try again later." };
  }

  try {
    const client = await clerkClient();
    const targetUser = await client.users.getUser(userId);
    const targetRole =
      ((targetUser.publicMetadata as Record<string, unknown>)?.role as string) || "user";
    const targetRoleLevel = ROLE_HIERARCHY[targetRole as keyof typeof ROLE_HIERARCHY] ?? 0;
    const adminRoleLevel = ROLE_HIERARCHY[admin.role as keyof typeof ROLE_HIERARCHY] ?? 0;
    if (targetRoleLevel >= adminRoleLevel) {
      return {
        success: false,
        error: "Cannot modify a user with a role equal to or above your own",
      };
    }
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { role: "user" },
    });

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    }
    const convex = new ConvexHttpClient(convexUrl);
    const { getToken } = await auth();
    const token = await getToken({ template: "convex" });
    if (token) {
      convex.setAuth(token);
    }
    await convex.mutation(api.users.updateUserRole, {
      clerkId: userId,
      role: "user",
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    console.error("Failed to remove user role:", err);
    return { success: false, error: "Failed to remove user role" };
  }
}
