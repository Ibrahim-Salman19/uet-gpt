import { vi } from "vitest";

export interface MockConvexCtx {
  runAction: ReturnType<typeof vi.fn>;
  runQuery: ReturnType<typeof vi.fn>;
  runMutation: ReturnType<typeof vi.fn>;
  auth: { getUserIdentity: ReturnType<typeof vi.fn> };
  scheduler: { runAfter: ReturnType<typeof vi.fn>; runAt: ReturnType<typeof vi.fn> };
  storage: { store: ReturnType<typeof vi.fn>; getUrl: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
}

export function createMockConvexCtx(): MockConvexCtx {
  return {
    runAction: vi.fn(),
    runQuery: vi.fn(),
    runMutation: vi.fn(),
    auth: {
      getUserIdentity: vi.fn(),
    },
    scheduler: {
      runAfter: vi.fn(),
      runAt: vi.fn(),
    },
    storage: {
      store: vi.fn(),
      getUrl: vi.fn(),
      delete: vi.fn(),
    },
  };
}
