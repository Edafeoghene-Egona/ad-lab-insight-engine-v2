import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders RETIRE for a loss label", () => {
    const { getByText } = render(<StatusBadge status="loss" />);
    expect(getByText("RETIRE")).toBeInTheDocument();
  });

  it("renders an em dash for an unlabeled creative", () => {
    const { getByText } = render(<StatusBadge status={null} />);
    expect(getByText("—")).toBeInTheDocument();
  });
});
