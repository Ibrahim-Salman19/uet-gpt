import { describe, expect, it } from "vitest";
import { dropNearDuplicates } from "../../convex/embeddings/nearDuplicates";

const nav =
  "Document Title: UET Taxila UG Admissions\nURL Path: /Schedule2.php\n" +
  "- [Merit List](<https://admissions.uettaxila.edu.pk/Merit_List.php>)\n" +
  "- [Fee Structure](<https://admissions.uettaxila.edu.pk/Fee.php>)\n" +
  "- [Diploma Holders](<https://admissions.uettaxila.edu.pk/DAE.php>)\n" +
  "- [Eligibility](<https://admissions.uettaxila.edu.pk/Eligiblity.php>)";

describe("dropNearDuplicates", () => {
  it("keeps the first of two chunks that differ only in whitespace artifacts", () => {
    const spaced = nav.replace(/uettaxila\.edu\.pk/g, "uettaxila. edu. pk");
    const eligibility =
      "Applicants who have passed DAE may apply for admission in the relevant discipline.";
    const results = [
      { id: "a", content: nav },
      { id: "b", content: spaced },
      { id: "c", content: eligibility },
    ];

    expect(dropNearDuplicates(results, 8).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("keeps distinct chunks from the same page", () => {
    const results = [
      { id: "fee", content: "BS Software Engineering tuition fee is Rs. 60,000 per semester." },
      { id: "hostel", content: "Hostel charges are Rs. 15,000 per semester including mess." },
    ];

    expect(dropNearDuplicates(results, 8).map((r) => r.id)).toEqual(["fee", "hostel"]);
  });

  it("fills the limit from lower-ranked candidates once duplicates are skipped", () => {
    const results = [
      { id: "a", content: nav },
      { id: "b", content: nav },
      { id: "c", content: "Entry test is held in July." },
      { id: "d", content: "Merit list is displayed in August." },
    ];

    expect(dropNearDuplicates(results, 2).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("does not collapse chunks with empty content into each other", () => {
    const results = [
      { id: "a", content: "" },
      { id: "b", content: "" },
    ];

    expect(dropNearDuplicates(results, 8).map((r) => r.id)).toEqual(["a", "b"]);
  });
});
