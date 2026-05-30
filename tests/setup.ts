import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock global fetch for all tests
global.fetch = vi.fn();
