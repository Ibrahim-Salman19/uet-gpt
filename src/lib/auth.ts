import { auth, currentUser } from "@clerk/nextjs/server";

export async function requireUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");
  const isAdmin =
    user.publicMetadata?.role === "admin" || user.publicMetadata?.role === "superadmin";
  if (!isAdmin) throw new Error("Forbidden");
  return user.id;
}

export async function getUserRole() {
  const user = await currentUser();
  if (!user) return null;
  return (user.publicMetadata?.role as string) ?? "user";
}
