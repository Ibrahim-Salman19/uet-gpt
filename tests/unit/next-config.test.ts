import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";

interface HeaderEntry {
  key: string;
  value: string;
}

interface HeaderRule {
  source: string;
  headers: HeaderEntry[];
}

interface NextConfig {
  output?: string;
  redirects?: () => Promise<unknown[]>;
  headers?: () => Promise<HeaderRule[]>;
}

const config = nextConfig as NextConfig;

/** Flatten all configured headers into a case-insensitive key -> value map. */
async function getHeaderMap(): Promise<Map<string, string>> {
  const rules = await config.headers!();
  const map = new Map<string, string>();
  for (const rule of rules) {
    for (const h of rule.headers) {
      map.set(h.key.toLowerCase(), h.value);
    }
  }
  return map;
}

describe("next config", () => {
  it("defines security headers and permanent redirects", async () => {
    expect(typeof config.headers).toBe("function");
    expect(typeof config.redirects).toBe("function");

    const redirects = await config.redirects!();
    expect(redirects.length).toBe(14);
    const sourceMap = new Map((redirects as Array<{ source: string; destination: string; permanent: boolean }>).map((r) => [r.source, r]));
    expect(sourceMap.get("/calculator")).toEqual({ source: "/calculator", destination: "/tools?tab=merit", permanent: true });
    expect(sourceMap.get("/gpa-calculator")).toEqual({ source: "/gpa-calculator", destination: "/tools?tab=gpa", permanent: true });
    expect(sourceMap.get("/merit-archive")).toEqual({ source: "/merit-archive", destination: "/tools?tab=archive", permanent: true });
    expect(sourceMap.get("/scholarship-finder")).toEqual({ source: "/scholarship-finder", destination: "/tools?tab=scholarships", permanent: true });
    expect(sourceMap.get("/calendar")).toEqual({ source: "/calendar", destination: "/academics?tab=calendar", permanent: true });
    expect(sourceMap.get("/resources")).toEqual({ source: "/resources", destination: "/academics?tab=resources", permanent: true });
    expect(sourceMap.get("/uet-taxila/admissions")).toEqual({ source: "/uet-taxila/admissions", destination: "/admissions?tab=overview", permanent: true });
    expect(sourceMap.get("/ecat-guide")).toEqual({ source: "/ecat-guide", destination: "/admissions?tab=ecat", permanent: true });
    expect(sourceMap.get("/uet-taxila/fee-structure")).toEqual({ source: "/uet-taxila/fee-structure", destination: "/admissions?tab=fees", permanent: true });
    expect(sourceMap.get("/scholarships")).toEqual({ source: "/scholarships", destination: "/admissions?tab=scholarships", permanent: true });
    expect(sourceMap.get("/compare")).toEqual({ source: "/compare", destination: "/admissions?tab=compare", permanent: true });
    expect(sourceMap.get("/bus-routes")).toEqual({ source: "/bus-routes", destination: "/campus-life?tab=transport", permanent: true });
    expect(sourceMap.get("/societies")).toEqual({ source: "/societies", destination: "/campus-life?tab=societies", permanent: true });
    expect(sourceMap.get("/directory")).toEqual({ source: "/directory", destination: "/campus-life?tab=directory", permanent: true });
  });

  it("sets the baseline security headers", async () => {
    const headers = await getHeaderMap();

    // Clickjacking / MIME-sniffing / referrer protections.
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");

    // HSTS with a long max-age and includeSubDomains.
    const hsts = headers.get("strict-transport-security");
    expect(hsts).toBeDefined();
    expect(hsts).toMatch(/max-age=\d{7,}/); // >= ~115 days; config uses 2yrs
    expect(hsts).toContain("includeSubDomains");

    // A CSP must be present and lock down framing / objects / base-uri.
    const csp = headers.get("content-security-policy");
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("does not allow 'unsafe-eval' in the production CSP", async () => {
    const prev = process.env.NODE_ENV;
    try {
      // headers() branches on NODE_ENV to drop 'unsafe-eval' in production.
      // @ts-expect-error NODE_ENV is normally readonly in @types/node
      process.env.NODE_ENV = "production";
      const headers = await getHeaderMap();
      const csp = headers.get("content-security-policy") ?? "";
      expect(csp).not.toContain("'unsafe-eval'");
    } finally {
      // @ts-expect-error restore
      process.env.NODE_ENV = prev;
    }
  });
});
