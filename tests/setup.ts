import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import { buildAdminMocks } from "./helpers/admin-mocks";

// Mock global fetch for all tests
global.fetch = vi.fn();

(globalThis as any).buildAdminMocks = buildAdminMocks;
