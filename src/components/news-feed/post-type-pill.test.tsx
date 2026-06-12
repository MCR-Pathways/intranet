import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostTypePill } from "./post-type-pill";

describe("PostTypePill", () => {
  it("renders the Poll pill", () => {
    render(<PostTypePill type="poll" />);
    expect(screen.getByText("Poll")).toBeInTheDocument();
  });

  it("renders the Pinned pill", () => {
    render(<PostTypePill type="pinned" />);
    expect(screen.getByText("Pinned")).toBeInTheDocument();
  });
});
