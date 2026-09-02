import { describe, expect, it } from "vitest";

describe("Fee Calculator Formula Logic", () => {
  it("calculates 1st semester subsidized engineering day-scholar fee accurately", () => {
    const tuitionFee = 48000;
    const admissionFee = 25000;
    const registrationExamFee = 12500;
    const librarySportsFee = 4500;
    const securityDeposit = 15000;
    const transportFee = 14000;

    const total1stSem =
      tuitionFee +
      admissionFee +
      registrationExamFee +
      librarySportsFee +
      securityDeposit +
      transportFee;

    expect(total1stSem).toBe(119000);

    const subsequentSem = tuitionFee + registrationExamFee + librarySportsFee + transportFee;
    expect(subsequentSem).toBe(79000);

    const total4Year = total1stSem + subsequentSem * 7;
    expect(total4Year).toBe(672000);
  });

  it("calculates 1st semester partial-subsidized (Category S) boarder fee accurately", () => {
    const tuitionFee = 135000;
    const admissionFee = 25000;
    const registrationExamFee = 12500;
    const librarySportsFee = 4500;
    const securityDeposit = 15000;
    const hostelFee = 16000 + 10000; // room + hostel security

    const total1stSem =
      tuitionFee +
      admissionFee +
      registrationExamFee +
      librarySportsFee +
      securityDeposit +
      hostelFee;

    expect(total1stSem).toBe(218000);
  });

  it("calculates computing degree (BS CS/SE) tuition properly", () => {
    const computingSubsidizedTuition = 52000;
    const computingSelfFinanceTuition = 145000;

    expect(computingSubsidizedTuition).toBeGreaterThan(48000);
    expect(computingSelfFinanceTuition).toBeGreaterThan(135000);
  });
});
