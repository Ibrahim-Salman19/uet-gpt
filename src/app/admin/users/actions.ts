"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { isAdminRole } from "@/lib/permissions";
import { checkAdminActionRateLimit } from "@/lib/rate-limit";

const VALID_ROLES = ["user", "admin", "superadmin"] as const;

export type UserResult = {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
  role: string;
  createdAt: number;
};

async function getAuthenticatedAdmin(): Promise<{ userId: string; role: string } | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = (user.publicMetadata as Record<string, unknown>)?.role as string;
  if (!isAdminRole(role)) return null;

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

  const rateCheck = await checkAdminActionRateLimit(admin.userId);
  if (rateCheck && !rateCheck.success) {
    return { success: false, error: "Rate limit exceeded. Try again later." };
  }

  if (!VALID_ROLES.includes(newRole as (typeof VALID_ROLES)[number])) {
    return { success: false, error: "Invalid role" };
  }

  try {
    const client = await clerkClient();
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

  const rateCheck = await checkAdminActionRateLimit(admin.userId);
  if (rateCheck && !rateCheck.success) {
    return { success: false, error: "Rate limit exceeded. Try again later." };
  }

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { role: "user" },
    });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    console.error("Failed to remove user role:", err);
    return { success: false, error: "Failed to remove user role" };
  }
}
