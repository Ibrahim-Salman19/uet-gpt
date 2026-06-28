import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Tailwind v4 uses CSS-based configuration via @theme in globals.css — there
// is no tailwind.config.ts file. This test verifies the design-token contract
// instead: that globals.css defines the expected UET brand tokens and applies
// them through the standard --color-* @theme aliases.

const globalsPath = join(import.meta.dirname, "../../src/app/globals.css");
const globalsCss = readFileSync(globalsPath, "utf-8");

describe("tailwind config (v4 CSS-based)", () => {
  it("globals.css uses Tailwind v4 @import", () => {
    expect(globalsCss).toContain("@import \"tailwindcss\"");
  });

  it("globals.css defines UET gold brand token", () => {
    expect(globalsCss).toContain("--uet-gold-raw");
  });

  it("globals.css defines UET navy brand token", () => {
    expect(globalsCss).toContain("--uet-navy-raw");
  });

  it("globals.css has @theme block with colour aliases", () => {
    expect(globalsCss).toContain("@theme");
    expect(globalsCss).toContain("--color-primary");
  });
});
