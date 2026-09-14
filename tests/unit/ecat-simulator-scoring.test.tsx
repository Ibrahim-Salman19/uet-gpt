// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdmissionsHub } from "@/components/admissions/admissions-hub";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("tab=ecat"),
  usePathname: () => "/admissions",
}));

// UET Lahore's official ECAT page (ecat.uet.edu.pk/General/Ecat): "no negative marking in ECAT".
describe("ECAT score simulator", () => {
  it("scores correct answers only; wrong answers never deduct marks", () => {
    const { container } = render(<AdmissionsHub />);
    const score = () => screen.getByText("Simulated Score").nextElementSibling?.textContent;
    const sliders = container.querySelectorAll<HTMLInputElement>('input[type="range"]');

    // Defaults: 22 + 20 + 21 + 7 = 70 correct
    expect(score()).toBe("280");

    const mathWrong = sliders[1] as HTMLInputElement;
    fireEvent.change(mathWrong, { target: { value: "0" } });
    expect(score()).toBe("280");
    expect(container.textContent).toContain("Skipped: 17");

    fireEvent.change(sliders[0] as HTMLInputElement, { target: { value: "30" } });
    expect(score()).toBe("312");
  });
});
