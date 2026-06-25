import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { buildAdminMocks } from "./helpers/admin-mocks";

// Mock global fetch for all tests
global.fetch = vi.fn();

(globalThis as any).buildAdminMocks = buildAdminMocks;

// Restore/reset mocks after every test so suites cannot leak fetch (or any
// other) mock state into a subsequently-running suite. Without this, a test
// that relies on the bare `global.fetch` mock above would inherit whatever the
// previous test left behind, producing order-dependent flakiness. Each suite
// that needs a specific fetch behaviour sets it in its own beforeEach, and this
// hook guarantees a clean baseline afterward.
afterEach(() => {
  vi.restoreAllMocks();
  // restoreAllMocks restores spies but leaves the standalone `global.fetch`
  // vi.fn() assigned above with accumulated calls; reset it to a clean mock.
  global.fetch = vi.fn();
});
