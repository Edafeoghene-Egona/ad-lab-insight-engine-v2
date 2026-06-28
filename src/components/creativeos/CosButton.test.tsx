import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CosButton } from "./CosButton";

describe("CosButton", () => {
  it("defaults to type=button (avoids accidental form submits)", () => {
    render(<CosButton>Refresh</CosButton>);
    expect(screen.getByRole("button", { name: "Refresh" }).getAttribute("type")).toBe("button");
  });

  it("applies the brand variant by default", () => {
    render(<CosButton>Go</CosButton>);
    expect(screen.getByRole("button", { name: "Go" }).className).toContain("bg-indigo-600");
  });

  it("renders as a child element (asChild) without forcing a type attribute", () => {
    render(
      <CosButton asChild variant="outline">
        <a href="https://example.com">Open</a>
      </CosButton>,
    );
    const link = screen.getByRole("link", { name: "Open" });
    expect(link.getAttribute("type")).toBeNull();
    expect(link.className).toContain("border-slate-200");
  });
});
