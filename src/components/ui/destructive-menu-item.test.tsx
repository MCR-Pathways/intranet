import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { DestructiveMenuItem } from "./destructive-menu-item";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu";

describe("DestructiveMenuItem", () => {
  it("renders with destructive classes across idle, focus, and data-[highlighted] states", () => {
    const { getByText } = render(
      <DropdownMenu open>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DestructiveMenuItem>Delete</DestructiveMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    const item = getByText("Delete");
    const cls = item.className;
    expect(cls).toContain("text-destructive");
    expect(cls).toContain("focus:text-destructive");
    expect(cls).toContain("focus:bg-destructive/10");
    expect(cls).toContain("data-[highlighted]:text-destructive");
    expect(cls).toContain("data-[highlighted]:bg-destructive/10");
  });

  it("merges additional className", () => {
    const { getByText } = render(
      <DropdownMenu open>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DestructiveMenuItem className="gap-4">Delete</DestructiveMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(getByText("Delete").className).toContain("gap-4");
  });
});
