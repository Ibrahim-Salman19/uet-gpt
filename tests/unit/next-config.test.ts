import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";

describe("next config", () => {
  it("defines redirects and standalone output", () => {
    expect((nextConfig as any).output).toBe("standalone");
    expect(typeof (nextConfig as any).redirects).toBe("function");
    expect(typeof (nextConfig as any).headers).toBe("function");
  });
});
