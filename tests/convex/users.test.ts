vi.mock("../../convex/_generated/server", () => ({
  mutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  query: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalMutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalQuery: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";

interface MockUserCtx {
  auth: { getUserIdentity: ReturnType<typeof vi.fn> };
  db: {
    query: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
  };
}

function makeUniqueChain(value: unknown) {
  return {
    withIndex: vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(value) }),
  };
}

function createMockCtx(): MockUserCtx {
  return {
    auth: { getUserIdentity: vi.fn() },
    db: {
      query: vi.fn(),
      insert: vi.fn().mockResolvedValue("new-user-id" as Id<"users">),
      patch: vi.fn(),
    },
  };
}

describe("users", () => {
  let ctx: MockUserCtx;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockCtx();
  });

  describe("getOrCreate", () => {
    it("returns existing user id when user already exists (via Clerk identity)", async () => {
      const fakeUser = { _id: "existing-id" as Id<"users">, clerkId: "clerk_123", isActive: true };
      ctx.db.query.mockReturnValue(makeUniqueChain(fakeUser));
      ctx.auth.getUserIdentity.mockResolvedValue({ subject: "clerk_123", email: "test@example.com" });

      const { getOrCreate } = await import("../../convex/users");
      const handler = (getOrCreate as unknown as { handler: (ctx: MockUserCtx, args: any) => Promise<Id<"users">> }).handler;

      const result = await handler(ctx, {
        clerkId: "clerk_123",
        name: "Test User",
        email: "test@example.com",
      });

      expect(result).toBe(fakeUser._id);
      expect(ctx.db.patch).toHaveBeenCalledWith(fakeUser._id, expect.objectContaining({ name: "Test User", email: "test@example.com" }));
      expect(ctx.db.insert).not.toHaveBeenCalled();
    });

    it("creates new user when user does not exist (via Clerk identity)", async () => {
      ctx.db.query.mockReturnValue(makeUniqueChain(null));
      ctx.auth.getUserIdentity.mockResolvedValue({ subject: "clerk_new", email: "new@example.com" });

      const { getOrCreate } = await import("../../convex/users");
      const handler = (getOrCreate as unknown as { handler: (ctx: MockUserCtx, args: any) => Promise<Id<"users">> }).handler;

      const result = await handler(ctx, {
        clerkId: "clerk_new",
        name: "New User",
        email: "new@example.com",
        imageUrl: "https://example.com/avatar.png",
      });

      expect(result).toBe("new-user-id" as Id<"users">);
      expect(ctx.db.insert).toHaveBeenCalledWith("users", expect.objectContaining({
        clerkId: "clerk_new",
        name: "New User",
        email: "new@example.com",
        imageUrl: "https://example.com/avatar.png",
        role: "user",
      }));
    });

    it("creates new user without optional imageUrl", async () => {
      ctx.db.query.mockReturnValue(makeUniqueChain(null));
      ctx.auth.getUserIdentity.mockResolvedValue({ subject: "clerk_noimg", email: "noimg@example.com" });

      const { getOrCreate } = await import("../../convex/users");
      const handler = (getOrCreate as unknown as { handler: (ctx: MockUserCtx, args: any) => Promise<Id<"users">> }).handler;

      await handler(ctx, {
        clerkId: "clerk_noimg",
        name: "No Image",
        email: "noimg@example.com",
      });

      const insertCall = ctx.db.insert.mock.calls[0]!;
      expect(insertCall[0]).toBe("users");
      expect(insertCall[1]).not.toHaveProperty("imageUrl");
    });

    it("throws when no identity", async () => {
      ctx.auth.getUserIdentity.mockResolvedValue(null);

      const { getOrCreate } = await import("../../convex/users");
      const handler = (getOrCreate as unknown as { handler: (ctx: MockUserCtx, args: any) => Promise<Id<"users">> }).handler;

      await expect(handler(ctx, { clerkId: "clerk_123", name: "Test", email: "test@example.com" })).rejects.toThrow("Authentication required");
    });
  });

  describe("getByClerkId", () => {
    it("returns user when found and authenticated as same user", async () => {
      const fakeUser = { _id: "uid1" as Id<"users">, clerkId: "clerk_123", role: "user", name: "Test", email: "test@example.com", isActive: true };
      ctx.auth.getUserIdentity.mockResolvedValue({ subject: "clerk_123" });
      ctx.db.query.mockReturnValue(makeUniqueChain(fakeUser));

      const { getByClerkId } = await import("../../convex/users");
      const handler = (getByClerkId as unknown as { handler: (ctx: MockUserCtx, args: { clerkId: string }) => Promise<any> }).handler;

      const result = await handler(ctx, { clerkId: "clerk_123" });
      expect(result).toEqual(fakeUser);
    });

    it("returns null when no identity", async () => {
      ctx.auth.getUserIdentity.mockResolvedValue(null);

      const { getByClerkId } = await import("../../convex/users");
      const handler = (getByClerkId as unknown as { handler: (ctx: MockUserCtx, args: { clerkId: string }) => Promise<any> }).handler;

      const result = await handler(ctx, { clerkId: "clerk_999" });
      expect(result).toBeNull();
    });

    it("returns null when querying different user and caller is not admin", async () => {
      const callerUser = { _id: "caller-id" as Id<"users">, clerkId: "caller_clerk", role: "user", name: "Caller", email: "caller@example.com", isActive: true };
      ctx.auth.getUserIdentity.mockResolvedValue({ subject: "caller_clerk" });
      ctx.db.query
        .mockReturnValueOnce(makeUniqueChain(callerUser))
        .mockReturnValueOnce(makeUniqueChain(null));

      const { getByClerkId } = await import("../../convex/users");
      const handler = (getByClerkId as unknown as { handler: (ctx: MockUserCtx, args: { clerkId: string }) => Promise<any> }).handler;

      const result = await handler(ctx, { clerkId: "other_clerk" });
      expect(result).toBeNull();
    });

    it("allows admin to query any user", async () => {
      const adminUser = { _id: "admin-id" as Id<"users">, clerkId: "admin_clerk", role: "admin", name: "Admin", email: "admin@example.com", isActive: true };
      const targetUser = { _id: "target-id" as Id<"users">, clerkId: "target_clerk", role: "user", name: "Target", email: "target@example.com", isActive: true };
      ctx.auth.getUserIdentity.mockResolvedValue({ subject: "admin_clerk" });
      ctx.db.query
        .mockReturnValueOnce(makeUniqueChain(adminUser))
        .mockReturnValueOnce(makeUniqueChain(targetUser));

      const { getByClerkId } = await import("../../convex/users");
      const handler = (getByClerkId as unknown as { handler: (ctx: MockUserCtx, args: { clerkId: string }) => Promise<any> }).handler;

      const result = await handler(ctx, { clerkId: "target_clerk" });
      expect(result).toEqual(targetUser);
    });
  });
});
