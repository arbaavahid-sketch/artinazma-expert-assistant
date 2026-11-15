import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import QuickCalculators from "../QuickCalculators";
import { resetQuickStore } from "../quick-store";

const mocks = vi.hoisted(() => ({ locale: "fa", track: vi.fn(), request: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ locale: mocks.locale }) }));
vi.mock("@/lib/calculation-activity", () => ({ trackCalculation: mocks.track }));
vi.mock("@/lib/api", () => ({ apiUrl: (path: string) => path, customerFetch: mocks.request }));
vi.mock("@/lib/save-pdf-file", () => ({ savePDFFile: mocks.save }));
vi.mock("../GumBudget", () => ({ default: () => null }));

beforeEach(() => {
  localStorage.clear();
  resetQuickStore();
  mocks.locale = "fa";
  mocks.track.mockClear();
  mocks.request.mockReset();
  mocks.save.mockReset();
});

const runExample = (en = false) => {
  fireEvent.click(screen.getByRole("button", { name: en ? "Load example" : "بارگذاری نمونه" }));
  fireEvent.click(screen.getByRole("button", { name: en ? "Calculate" : "محاسبه" }));
};

it("shows the working and the result in one digit system and records a stable tool id", () => {
  render(<QuickCalculators />);
  runExample();
  expect(screen.getAllByText("۲۵ mL")).toHaveLength(2); // the result and its history entry
  expect(screen.getByText("۰٫۱ × ۲۵۰ / ۱ = ۲۵ mL")).toBeInTheDocument();
  expect(mocks.track).toHaveBeenCalledWith("quick-dilution", "success", "رقیق‌سازی محلول");
});

it("marks a rounded result with ≈ and follows the chosen significant figures", () => {
  mocks.locale = "en";
  render(<QuickCalculators />);
  fireEvent.change(screen.getByLabelText("Stock concentration"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Target concentration"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Final volume"), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  expect(screen.getByText("1 × 100 / 3 ≈ 33.3333 mL")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Significant figures"), { target: { value: "3" } });
  expect(screen.getByText("1 × 100 / 3 ≈ 33.3 mL")).toBeInTheDocument();
});

it("keeps recent calculations and reopens one with its inputs and result", () => {
  mocks.locale = "en";
  render(<QuickCalculators />);
  expect(screen.queryByText("Recent calculations")).not.toBeInTheDocument();
  runExample(true);
  runExample(true);
  const recent = screen.getByText("Recent calculations").closest("details")!;
  expect(within(recent).getAllByRole("listitem")).toHaveLength(1);
  expect(within(recent).getByText("25 mL")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Pressure conversion/ }));
  expect(screen.queryByText("Stock solution volume")).not.toBeInTheDocument();
  fireEvent.click(within(recent).getByRole("button", { name: /^Open Solution dilution/ }));
  expect(screen.getByText("Stock solution volume")).toBeInTheDocument();
  expect(screen.getByDisplayValue("250")).toBeInTheDocument();
  expect(mocks.track).toHaveBeenCalledTimes(2);

  fireEvent.click(within(recent).getByRole("button", { name: "Clear history" }));
  expect(screen.queryByText("Recent calculations")).not.toBeInTheDocument();
  expect(localStorage.getItem("artin.quick-history.v1")).toBe("[]");
});

it("does not store a calculation that failed validation", () => {
  mocks.locale = "en";
  render(<QuickCalculators />);
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  expect(mocks.track).toHaveBeenCalledWith("quick-dilution", "error", "Solution dilution");
  expect(screen.queryByText("Recent calculations")).not.toBeInTheDocument();
});

it("sends the on-screen calculation to the PDF service", async () => {
  mocks.locale = "en";
  mocks.request.mockResolvedValue({ ok: true, headers: new Headers({ "content-type": "application/pdf" }), blob: async () => new Blob(["%PDF-1.7"]) });
  mocks.save.mockResolvedValue("saved");
  render(<QuickCalculators />);
  runExample(true);
  fireEvent.click(screen.getByRole("button", { name: "Save as PDF" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalled());
  expect(mocks.request.mock.calls[0][0]).toBe("/uncertainty/quick-report.pdf");
  expect(JSON.parse(mocks.request.mock.calls[0][1].body)).toMatchObject({
    locale: "en", tool: "dilution", title: "Solution dilution", formula: "V₁ = C₂ × V₂ / C₁",
    inputs: [{ label: "Stock concentration", value: "1 mol/L" }, { label: "Target concentration", value: "0.1 mol/L" }, { label: "Final volume", value: "250 mL" }],
    results: ["25 mL", "0.1 × 250 / 1 = 25 mL"],
  });
  expect(mocks.save.mock.calls[0][1]).toBe("artin-quick-dilution-en.pdf");
  expect(await screen.findByText("The selected PDF was saved.")).toBeInTheDocument();
});
