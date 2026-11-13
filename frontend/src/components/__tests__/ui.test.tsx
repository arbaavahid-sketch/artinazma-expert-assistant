import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert, Badge, Button, ButtonLink, Card, EmptyState } from "../ui";

describe("ui primitives", () => {
  it("renders a button with the variant class and merges className", () => {
    render(<Button variant="primary" className="w-full">ذخیره</Button>);
    const btn = screen.getByRole("button", { name: "ذخیره" });
    expect(btn.className).toContain("ui-btn-primary");
    expect(btn.className).toContain("w-full");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("renders a link that looks like a button", () => {
    render(<ButtonLink href="/admin" variant="danger">خروج</ButtonLink>);
    const link = screen.getByRole("link", { name: "خروج" });
    expect(link).toHaveAttribute("href", "/admin");
    expect(link.className).toContain("ui-btn-danger");
  });

  it("gives a danger alert role=alert and other tones role=status", () => {
    render(<Alert tone="danger">خطا</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("خطا");
    render(<Alert tone="success">شد</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent("شد");
  });

  it("renders badge, card and empty state with their base classes", () => {
    const { container } = render(
      <Card>
        <Badge tone="warning">در انتظار</Badge>
        <EmptyState>خالی</EmptyState>
      </Card>,
    );
    expect(container.querySelector(".ui-card")).not.toBeNull();
    expect(container.querySelector(".ui-empty")).not.toBeNull();
    expect(screen.getByText("در انتظار").className).toContain("--color-warning-bg");
  });
});
