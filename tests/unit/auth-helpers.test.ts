import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";

type TestCtx = {
  auth: { getUserIdentity: () => Promise<{ subject: string; tokenIdentifier?: string } | null> };
  db: {
    query: (table: "users") => {
      withIndex: (
        name: "by_clerkId",
        fn: (q: { eq: (field: "clerkId", value: string) => unknown }) => unknown,
      ) => { unique: () => Promise<{ _id: Id<"users">; role: string } | null> };
    };
    get: (id: Id<"users">) => Promise<{ role: string } | null>;
  };
};

function createMockCtx(): {
  auth: { getUserIdentity: ReturnType<typeof vi.fn<() => Promise<{ subject: string; tokenIdentifier?: string } | null>>> };
  db: {
    query: ReturnType<
      typeof vi.fn<
        (table: "users") => {
          withIndex: (
            name: "by_clerkId",
            fn: (q: { eq: (field: "clerkId", value: string) => unknown }) => unknown,
          ) => { unique: () => Promise<{ _id: Id<"users">; role: string } | null> };
        }
      >
    >;
    get: ReturnType<typeof vi.fn<(id: Id<"users">) => Promise<{ role: string } | null>>>;
  };
} {
  return {
    auth: {
      getUserIdentity: vi.fn<() => Promise<{ subject: string; tokenIdentifier?: string } | null>>(),
    },
    db: {
      query: vi.fn<
        (table: "users") => {
          withIndex: (
            name: "by_clerkId",
            fn: (q: { eq: (field: "clerkId", value: string) => unknown }) => unknown,
          ) => { unique: () => Promise<{ _id: Id<"users">; role: string } | null> };
        }
      >(),
      get: vi.fn<(id: Id<"users">) => Promise<{ role: string } | null>>(),
    },
  };
}

describe("convex/auth helpers", () => {
  describe("module exports", () => {
    it("exports getUserId, isAuthenticated, isAdmin", async () => {
      const mod = await import("../../convex/auth");
      expect(mod).toHaveProperty("getUserId");
      expect(mod).toHaveProperty("isAuthenticated");
      expect(mod).toHaveProperty("isAdmin");
    });

    it("exports are async functions", async () => {
      const mod = await import("../../convex/auth");
      expect(mod.getUserId.constructor.name).toBe("AsyncFunction");
      expect(mod.isAuthenticated.constructor.name).toBe("AsyncFunction");
      expect(mod.isAdmin.constructor.name).toBe("AsyncFunction");
    });
  });

  describe("getUserId", () => {
    it("returns null when no identity", async () => {
      const { getUserId } = await import("../../convex/auth");
      const ctx = createMockCtx();
      ctx.auth.getUserIdentity.mockResolvedValue(null);
      const result = await getUserId(ctx as unknown as TestCtx);
      expect(result).toBeNull();
    });

    it("returns null when user not found in db", async () => {
      const { getUserId } = await import("../../convex/auth");
      const ctx = createMockCtx();
      ctx.auth.getUserIdentity.mockResolvedValue({
        subject: "user_abc123",
        tokenIdentifier: "token_abc",
      });
      const withIndex = vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(null) });
      ctx.db.query.mockReturnValue({ withIndex });
      const result = await getUserId(ctx as unknown as TestCtx);
      expect(result).toBeNull();
    });

    it("returns user _id when identity and user exist", async () => {
      const { getUserId } = await import("../../convex/auth");
      const ctx = createMockCtx();
      ctx.auth.getUserIdentity.mockResolvedValue({
        subject: "user_abc123",
        tokenIdentifier: "token_abc",
      });
      const fakeUser = { _id: "some-user-id", clerkId: "user_abc123" };
      const withIndex = vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(fakeUser) });
      ctx.db.query.mockReturnValue({ withIndex });
      const result = await getUserId(ctx as unknown as TestCtx);
      expect(result).toBe(fakeUser._id);
    });

    it("queries users table by clerkId from identity subject", async () => {
      const { getUserId } = await import("../../convex/auth");
      const ctx = createMockCtx();
      ctx.auth.getUserIdentity.mockResolvedValue({
        subject: "user_def456",
        tokenIdentifier: "token_def",
      });
      const withIndex = vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(null) });
      ctx.db.query.mockReturnValue({ withIndex });
      await getUserId(ctx as unknown as TestCtx);
      expect(ctx.db.query).toHaveBeenCalledWith("users");
      expect(withIndex).toHaveBeenCalledWith("by_clerkId", expect.any(Function));
    });
  });

  describe("isAuthenticated", () => {
    it("returns false when no identity", async () => {
      const { isAuthenticated } = await import("../../convex/auth");
      const ctx = createMockCtx();
      ctx.auth.getUserIdentity.mockResolvedValue(null);
      const result = await isAuthenticated(ctx as unknown as TestCtx);
      expect(result).toBe(false);
    });

    it("returns true when identity exists", async () => {
      const { isAuthenticated } = await import("../../convex/auth");
      const ctx = createMockCtx();
      ctx.auth.getUserIdentity.mockResolvedValue({
        subject: "user_abc",
        tokenIdentifier: "token_abc",
      });
      const result = await isAuthenticated(ctx as unknown as TestCtx);
      expect(result).toBe(true);
    });
  });

  describe("isAdmin", () => {
    it("returns false when no identity", async () => {
      const { isAdmin } = await import("../../convex/auth");
      const ctx = createMockCtx();
      ctx.auth.getUserIdentity.mockResolvedValue(null);
      const result = await isAdmin(ctx as unknown as TestCtx);
      expect(result).toBe(false);
    });

    it("returns false when user not found in db", async () => {
      const { isAdmin } = await import("../../convex/auth");
      const ctx = createMockCtx();
      ctx.auth.getUserIdentity.mockResolvedValue({
        subject: "user_abc",
        tokenIdentifier: "token_abc",
      });
      ctx.auth.getUserIdentity.mockResolvedValue({
        subject: "user_abc",
        tokenIdentifier: "token_abc",
      });
      const withIndex = vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(null) });
      ctx.db.query.mockReturnValue({ withIndex });
      const result = await isAdmin(ctx as unknown as TestCtx);
      expect(result).toBe(false);
    });

    it("returns false when user role is 'user'", async () => {
      const { isAdmin } = await import("../../convex/auth");
      const ctx = createMockCtx();
      ctx.auth.getUserIdentity.mockResolvedValue({
        subject: "user_abc",
        tokenIdentifier: "token_abc",
      });
      const fakeUser = { _id: "uid1", role: "user" };
      const withIndex = vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(fakeUser) });
      ctx.db.query.mockReturnValue({ withIndex });
      const result = await isAdmin(ctx as unknown as TestCtx);
      expect(result).toBe(false);
    });

    it("returns true when user role is 'admin'", async () => {
      const { isAdmin } = await import("../../convex/auth");
      const ctx = createMockCtx();
      ctx.auth.getUserIdentity.mockResolvedValue({
        subject: "user_abc",
        tokenIdentifier: "token_abc",
      });
      const fakeUser = { _id: "uid1", role: "admin" };
      const withIndex = vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(fakeUser) });
      ctx.db.query.mockReturnValue({ withIndex });
      const result = await isAdmin(ctx as unknown as TestCtx);
      expect(result).toBe(true);
    });

    it("returns true when user role is 'superadmin'", async () => {
      const { isAdmin } = await import("../../convex/auth");
      const ctx = createMockCtx();
      ctx.auth.getUserIdentity.mockResolvedValue({
        subject: "user_abc",
        tokenIdentifier: "token_abc",
      });
      const fakeUser = { _id: "uid1", role: "superadmin" };
      const withIndex = vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(fakeUser) });
      ctx.db.query.mockReturnValue({ withIndex });
      const result = await isAdmin(ctx as unknown as TestCtx);
      expect(result).toBe(true);
    });
  });
});
