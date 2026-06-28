import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PageHeader } from "./PageHeader";

const window = { start: "2026-06-11", end: "2026-06-25" };
const subProps = { subs: ["Portfolio"], activeSub: "Portfolio", onSub: () => {} };

describe("PageHeader client-header gating", () => {
  it("does NOT render the client header on the portfolio view", () => {
    const { queryByTestId, getByText } = render(
      <PageHeader tabTitle="Command Center" window={window} selectedClient={null} {...subProps} />,
    );
    expect(queryByTestId("cos-client-header")).toBeNull();
    expect(getByText("Command Center")).toBeInTheDocument();
  });

  it("renders the client header when a client is selected", () => {
    const { getByTestId } = render(
      <PageHeader
        tabTitle="Creative Testing Lab"
        window={window}
        selectedClient={{ customerId: "711-060-6646", name: "glowora.com" }}
        {...subProps}
      />,
    );
    expect(getByTestId("cos-client-header")).toBeInTheDocument();
  });
});
