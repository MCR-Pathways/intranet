import { describe, it, expect } from "vitest";
import {
  glossaryEntryText,
  extractGlossaryEntryTexts,
  extractGlossarySections,
  normalizeFilterText,
} from "./glossary-text";

const entry = (term: string, def: string) => ({
  type: "glossary_entry",
  children: [
    { type: "glossary_term", children: [{ text: term }] },
    { type: "glossary_definition", children: [{ text: def }] },
  ],
});

describe("glossaryEntryText", () => {
  it("joins term and definition with a space, lower-cased", () => {
    expect(glossaryEntryText(entry("Advocate", "An advocate speaks up."))).toBe(
      "advocate an advocate speaks up.",
    );
  });

  it("does not glue the term to the definition's first word", () => {
    expect(glossaryEntryText(entry("Advocate", "An advocate…"))).not.toContain(
      "advocatean",
    );
  });

  it("collapses internal whitespace", () => {
    const e = {
      type: "glossary_entry",
      children: [
        { type: "glossary_term", children: [{ text: "  CSO " }] },
        { type: "glossary_definition", children: [{ text: "Compulsory   Supervision" }] },
      ],
    };
    expect(glossaryEntryText(e)).toBe("cso compulsory supervision");
  });
});

describe("extractGlossaryEntryTexts", () => {
  it("returns every entry's text in document order, across sections", () => {
    const value = [
      { type: "p", children: [{ text: "Intro" }] },
      { type: "h2", children: [{ text: "Terms" }] },
      {
        type: "glossary",
        variant: "terms",
        children: [entry("Advocate", "Speaks up."), entry("Befriender", "Offers support.")],
      },
      { type: "h2", children: [{ text: "Acronyms" }] },
      {
        type: "glossary",
        variant: "acronyms",
        children: [entry("ASN", "Additional Support Needs")],
      },
    ];
    expect(extractGlossaryEntryTexts(value)).toEqual([
      "advocate speaks up.",
      "befriender offers support.",
      "asn additional support needs",
    ]);
  });

  it("returns an empty array for content with no glossary", () => {
    expect(
      extractGlossaryEntryTexts([{ type: "p", children: [{ text: "No glossary here" }] }]),
    ).toEqual([]);
    expect(extractGlossaryEntryTexts(undefined)).toEqual([]);
  });
});

describe("normalizeFilterText", () => {
  it("folds curly apostrophes to straight, lower-cased", () => {
    // A query typed with a straight apostrophe should match a curly source.
    expect(normalizeFilterText("Children’s")).toBe("children's");
    expect(glossaryEntryText(entry("Children’s Hearing", "A legal meeting."))).toBe(
      "children's hearing a legal meeting.",
    );
  });
});

describe("extractGlossarySections", () => {
  it("groups each heading with the entries of the glossary that follows it", () => {
    const value = [
      { type: "p", children: [{ text: "Intro" }] },
      { type: "h2", children: [{ text: "Terms" }] },
      { type: "glossary", variant: "terms", children: [entry("Advocate", "Speaks up.")] },
      { type: "h2", children: [{ text: "Acronyms" }] },
      {
        type: "glossary",
        variant: "acronyms",
        children: [entry("ASN", "Additional Support Needs"), entry("CSO", "Compulsory Supervision Order")],
      },
    ];
    expect(extractGlossarySections(value)).toEqual([
      { heading: "Terms", entryTexts: ["advocate speaks up."] },
      {
        heading: "Acronyms",
        entryTexts: ["asn additional support needs", "cso compulsory supervision order"],
      },
    ]);
  });
});
