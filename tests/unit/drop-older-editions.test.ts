import { describe, expect, it } from "vitest";
import { dropOlderEditions } from "../../convex/embeddings/search";

const at = (url: string) => ({ url });
const urls = (rs: { url: string }[]) => rs.map((r) => r.url);

describe("dropOlderEditions", () => {
  it("keeps only the newest edition of a year family", () => {
    const kept = dropOlderEditions([
      at("https://admissions.uettaxila.edu.pk/Downloads/UET-Prospectus-2024.pdf"),
      at("https://admissions.uettaxila.edu.pk/Downloads/UET-Prospectus-2025.pdf"),
      at("https://admissions.uettaxila.edu.pk/Downloads/UET-Prospectus-2023.pdf"),
    ]);
    expect(urls(kept)).toEqual([
      "https://admissions.uettaxila.edu.pk/Downloads/UET-Prospectus-2025.pdf",
    ]);
  });

  it("collapses the 14 IEEE annual-report editions to the newest", () => {
    const kept = dropOlderEditions(
      [2021, 2019, 2024, 2016].map((y) =>
        at(`https://web.uettaxila.edu.pk/ieee/Downloads/IEEE_branch_${y}_Annual_Report.pdf`),
      ),
    );
    expect(urls(kept)).toEqual([
      "https://web.uettaxila.edu.pk/ieee/Downloads/IEEE_branch_2024_Annual_Report.pdf",
    ]);
  });

  it("never drops a url with no year in it", () => {
    const input = [at("https://admissions.uettaxila.edu.pk/FAQS.php"), at("https://x/a.php")];
    expect(urls(dropOlderEditions(input))).toEqual(urls(input));
  });

  it("keeps a year-bearing url that is the only member of its family", () => {
    const input = [
      at("https://web.uettaxila.edu.pk/news/convocation-2019"),
      at("https://web.uettaxila.edu.pk/SED/PG-fee.asp"),
    ];
    expect(urls(dropOlderEditions(input))).toEqual(urls(input));
  });

  it("does not let one family's year suppress an unrelated page", () => {
    const input = [
      at("https://web.uettaxila.edu.pk/reports/annual-2024.pdf"),
      at("https://web.uettaxila.edu.pk/reports/annual-2021.pdf"),
      at("https://web.uettaxila.edu.pk/events/seminar-2021.html"),
    ];
    // Different path families: only the older annual report goes.
    expect(urls(dropOlderEditions(input))).toEqual([
      "https://web.uettaxila.edu.pk/reports/annual-2024.pdf",
      "https://web.uettaxila.edu.pk/events/seminar-2021.html",
    ]);
  });

  it("ignores digit runs that are not 4-digit years", () => {
    const input = [at("https://x/doc-20241.pdf"), at("https://x/doc-20242.pdf")];
    expect(urls(dropOlderEditions(input))).toEqual(urls(input));
  });

  it("matches families across percent-encoding", () => {
    const kept = dropOlderEditions([
      at("https://x/Fee%20Structure%202024.pdf"),
      at("https://x/Fee Structure 2025.pdf"),
    ]);
    expect(urls(kept)).toEqual(["https://x/Fee Structure 2025.pdf"]);
  });

  it("keeps every chunk that shares one url - the shape production actually returns", () => {
    // F-1's measured pool has two distinct chunks both from PG-fee.asp. Same family,
    // same year, so both must survive; a `>` instead of `>=` would silently halve it.
    const input = [
      at("https://web.uettaxila.edu.pk/SED/PG-fee.asp"),
      at("https://web.uettaxila.edu.pk/SED/PG-fee.asp"),
      at("https://web.uettaxila.edu.pk/ieee/IEEE_branch_2021_Annual_Report.pdf"),
      at("https://web.uettaxila.edu.pk/ieee/IEEE_branch_2021_Annual_Report.pdf"),
    ];
    expect(urls(dropOlderEditions(input))).toEqual(urls(input));
  });

  it("preserves input order and is a no-op on an empty pool", () => {
    expect(dropOlderEditions([])).toEqual([]);
  });
});

describe("dropOlderEditions - years the user explicitly asked for", () => {
  const IEEE = (y: number) =>
    at(`https://web.uettaxila.edu.pk/ieee/Downloads/IEEE_branch_${y}_Annual_Report.pdf`);

  it("keeps a superseded edition when the question names that year", () => {
    const kept = dropOlderEditions([IEEE(2021), IEEE(2024)], "IEEE annual report 2021");
    expect(urls(kept)).toEqual([IEEE(2021).url, IEEE(2024).url]);
  });

  it("still supersedes when the question names no year", () => {
    expect(urls(dropOlderEditions([IEEE(2021), IEEE(2024)], "IEEE annual report"))).toEqual([
      IEEE(2024).url,
    ]);
  });

  it("protects only the year asked for, not every older edition", () => {
    const kept = dropOlderEditions([IEEE(2019), IEEE(2021), IEEE(2024)], "report for 2021");
    expect(urls(kept)).toEqual([IEEE(2021).url, IEEE(2024).url]);
  });

  it("keeps both editions when the question names both years", () => {
    // "compare the 2021 and 2024 reports" - askedYears is a Set, so both are protected.
    const kept = dropOlderEditions([IEEE(2019), IEEE(2021), IEEE(2024)], "compare 2021 and 2024");
    expect(urls(kept)).toEqual([IEEE(2021).url, IEEE(2024).url]);
  });

  it("is a no-op when the year asked for matches no family in the pool", () => {
    const kept = dropOlderEditions([IEEE(2021), IEEE(2024)], "what happened in 1998?");
    expect(urls(kept)).toEqual([IEEE(2024).url]);
  });

  it("defaults to superseding when no query text is supplied", () => {
    expect(urls(dropOlderEditions([IEEE(2021), IEEE(2024)]))).toEqual([IEEE(2024).url]);
  });
});
