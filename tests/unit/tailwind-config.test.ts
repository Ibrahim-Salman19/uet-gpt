import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("tailwind config css theme", () => {
  it("defines Kinpaku Gold brand accent", () => {
    const cssPath = path.resolve(__dirname, "../../src/app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");
    expect(cssContent).toContain("kinpaku-gold");
    expect(cssContent).toContain("--accent");
  });
});
