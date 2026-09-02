import { describe, expect, it } from "vitest";

function calculateUetAggregate({
  ecatMarks,
  ecatTotal = 400,
  hsscMarks,
  hsscTotal = 550,
  sscMarks,
  sscTotal = 1100,
  isHifzOrNcc = false,
}: {
  ecatMarks: number;
  ecatTotal?: number;
  hsscMarks: number;
  hsscTotal?: number;
  sscMarks: number;
  sscTotal?: number;
  isHifzOrNcc?: boolean;
}): number {
  const bonus = isHifzOrNcc ? 20 : 0;
  const adjustedHssc = hsscMarks + bonus;

  const ecatPct = (ecatMarks / ecatTotal) * 100;
  const hsscPct = (adjustedHssc / hsscTotal) * 100;
  const sscPct = (sscMarks / sscTotal) * 100;

  const aggregate = ecatPct * 0.33 + hsscPct * 0.5 + sscPct * 0.17;
  return Number(aggregate.toFixed(3));
}

describe("UET Taxila Merit Calculator Formula Fidelity", () => {
  it("matches official Table 18 prospectus worked example exactly (82.841%)", () => {
    // ECAT 300/400, SSC 700/1100, HSSC 500/550 with Hifz bonus (+20)
    const aggregate = calculateUetAggregate({
      ecatMarks: 300,
      ecatTotal: 400,
      sscMarks: 700,
      sscTotal: 1100,
      hsscMarks: 500,
      hsscTotal: 550,
      isHifzOrNcc: true,
    });

    expect(aggregate).toBe(82.841);
  });

  it("calculates standard pre-engineering intermediate without bonus", () => {
    // ECAT 280/400 (70% * 33 = 23.1%), HSSC 470/550 (85.455% * 50 = 42.727%), SSC 980/1100 (89.091% * 17 = 15.145%)
    // Aggregate = 23.1 + 42.727 + 15.145 = 80.973%
    const aggregate = calculateUetAggregate({
      ecatMarks: 280,
      ecatTotal: 400,
      hsscMarks: 470,
      hsscTotal: 550,
      sscMarks: 980,
      sscTotal: 1100,
      isHifzOrNcc: false,
    });

    expect(aggregate).toBe(80.973);
  });

  it("handles full FSc (1100 marks) format properly", () => {
    const aggregate = calculateUetAggregate({
      ecatMarks: 320,
      ecatTotal: 400, // 80% * 33 = 26.4
      hsscMarks: 950,
      hsscTotal: 1100, // 86.363% * 50 = 43.182
      sscMarks: 1000,
      sscTotal: 1100, // 90.909% * 17 = 15.455
    });

    expect(aggregate).toBe(85.036);
  });

  it("handles DAE track with custom total marks", () => {
    const aggregate = calculateUetAggregate({
      ecatMarks: 250,
      ecatTotal: 400,
      hsscMarks: 850,
      hsscTotal: 1000,
      sscMarks: 800,
      sscTotal: 1100,
    });

    expect(aggregate).toBeGreaterThan(70);
    expect(aggregate).toBeLessThan(80);
  });
});
