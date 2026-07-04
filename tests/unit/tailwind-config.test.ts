import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";

interface TailwindTheme {
  extend?: {
    colors?: Record<string, string>;
  };
}

interface TailwindConfig {
  darkMode?: string | string[];
  theme?: TailwindTheme;
}

describe("tailwind config", () => {
  it("defines UET brand colors and darkMode class", () => {
    expect(config).toHaveProperty("darkMode");
    expect(config.darkMode).toBe("class");
    const theme = (config as unknown as TailwindConfig).theme;
    expect(theme?.extend?.colors?.uetPrimary).toBeDefined();
    expect(theme?.extend?.colors?.uetGold).toBeDefined();
  });
});
