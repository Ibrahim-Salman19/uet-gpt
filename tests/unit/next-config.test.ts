import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

interface NextConfig {
  output?: string;
  redirects?: () => Promise<unknown[]>;
  headers?: () => Promise<unknown[]>;
}

describe("next config", () => {
  it("defines redirects and headers", () => {
    const config = nextConfig as NextConfig;
    expect(typeof config.redirects).toBe("function");
    expect(typeof config.headers).toBe("function");
  });
});
