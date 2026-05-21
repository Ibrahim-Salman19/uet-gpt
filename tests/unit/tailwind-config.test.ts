import { describe, it, expect } from "vitest";
import config from "../../tailwind.config";

describe("tailwind config", () => {
  it("defines UET brand colors and darkMode class", () => {
    expect(config).toHaveProperty("darkMode");
    expect(config.darkMode).toBe("class");
    const theme = (config as any).theme;
    expect(theme?.extend?.colors?.uetPrimary).toBeDefined();
    expect(theme?.extend?.colors?.uetGold).toBeDefined();
  });
});
