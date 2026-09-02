import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BusRoutesPage, { metadata } from "@/app/bus-routes/page";

describe("/bus-routes page", () => {
  it("exports valid SEO metadata conforming to character limits and canonical rules", () => {
    expect(metadata.title).toBeDefined();
    const title = String(metadata.title);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain("Bus Routes");

    const description = String(metadata.description);
    expect(description.length).toBeGreaterThan(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app/bus-routes");
  });

  it("renders commuter routes, departure timings, pickup stops, and JSON-LD in server HTML", () => {
    const html = renderToString(<BusRoutesPage />);

    expect(html).toContain("UET Taxila Bus Routes");
    expect(html).toContain("Islamabad Express");
    expect(html).toContain("Rawalpindi Saddar");
    expect(html).toContain("Wah Cantt");
    expect(html).toContain("06:45 AM");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("FAQPage");
    expect(html).toContain("BusTrip");
  });
});
