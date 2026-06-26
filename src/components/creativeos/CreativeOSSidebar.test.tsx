import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreativeOSSidebar } from "./CreativeOSSidebar";

describe("CreativeOSSidebar", () => {
  it("renders only the provided tab subset", () => {
    render(
      <CreativeOSSidebar tab="lab" onTab={() => {}} hasClient tabs={["lab", "hook", "trend", "vault"]} />,
    );
    expect(screen.queryByText("Command Center")).toBeNull();
    expect(screen.getByText("Creative Testing Lab")).toBeTruthy();
    expect(screen.getByText("Winning Vault")).toBeTruthy();
  });

  it("renders all tabs by default", () => {
    render(<CreativeOSSidebar tab="command" onTab={() => {}} hasClient />);
    expect(screen.getByText("Command Center")).toBeTruthy();
  });
});
