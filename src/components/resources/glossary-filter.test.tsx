import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, it, expect } from "vitest";
import { GlossaryFilter } from "./glossary-filter";

/**
 * The filter projects matches onto PlateStatic's zero-JS DOM. These cover the
 * heading aggregation: the glossary block is reusable, so a heading can sit
 * above more than one glossary. A heading must hide only when EVERY glossary
 * under it is empty — not whichever the loop visits last (the bug Gemini caught
 * on PR #329, where a trailing empty glossary hid a heading whose earlier
 * glossary still matched).
 */
function Harness({ query }: { query: string }) {
  const ref = useRef<HTMLElement>(null);
  return (
    <>
      <GlossaryFilter
        articleRef={ref}
        entryTexts={["alpha apple", "beta banana"]}
        query={query}
        onQueryChange={() => {}}
      />
      <article ref={ref}>
        <h2 data-testid="heading">Group</h2>
        <dl className="glossary" data-testid="g1">
          <div className="glossary-entry" data-testid="e1">
            <dt>Alpha</dt>
            <dd>Apple</dd>
          </div>
        </dl>
        <dl className="glossary" data-testid="g2">
          <div className="glossary-entry" data-testid="e2">
            <dt>Beta</dt>
            <dd>Banana</dd>
          </div>
        </dl>
      </article>
    </>
  );
}

describe("GlossaryFilter DOM projection", () => {
  it("keeps a heading visible when one of several glossaries under it still matches", () => {
    render(<Harness query="alpha" />);
    expect(screen.getByTestId("heading").hidden).toBe(false);
    expect(screen.getByTestId("g1").hidden).toBe(false);
    expect(screen.getByTestId("e1").hidden).toBe(false);
    expect(screen.getByTestId("g2").hidden).toBe(true);
    expect(screen.getByTestId("e2").hidden).toBe(true);
  });

  it("hides the heading only when every glossary under it is empty", () => {
    render(<Harness query="zzz" />);
    expect(screen.getByTestId("heading").hidden).toBe(true);
    expect(screen.getByTestId("g1").hidden).toBe(true);
    expect(screen.getByTestId("g2").hidden).toBe(true);
  });

  it("shows everything when the query is empty", () => {
    render(<Harness query="" />);
    expect(screen.getByTestId("heading").hidden).toBe(false);
    expect(screen.getByTestId("g1").hidden).toBe(false);
    expect(screen.getByTestId("e1").hidden).toBe(false);
    expect(screen.getByTestId("g2").hidden).toBe(false);
    expect(screen.getByTestId("e2").hidden).toBe(false);
  });
});
