import { vi } from "vitest";

export interface MockConvexCtx {
  runAction: ReturnType<typeof vi.fn>;
  runQuery: ReturnType<typeof vi.fn>;
  runMutation: ReturnType<typeof vi.fn>;
  auth: { getUserIdentity: ReturnType<typeof vi.fn> };
}

export function createMockConvexCtx(): MockConvexCtx {
  return {
    runAction: vi.fn(),
    runQuery: vi.fn(),
    runMutation: vi.fn(),
    auth: {
      getUserIdentity: vi.fn(),
    },
  };
}
