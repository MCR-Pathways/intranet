import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock env vars — must be set before the component reads them at module level
vi.stubEnv("NEXT_PUBLIC_ALGOLIA_APP_ID", "TEST_APP_ID");
vi.stubEnv("NEXT_PUBLIC_ALGOLIA_SEARCH_KEY", "TEST_SEARCH_KEY");

const mockUseSearchBox = vi.fn();
const mockUseHits = vi.fn();
const mockUseInstantSearch = vi.fn();

vi.mock("react-instantsearch", () => ({
  InstantSearch: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SearchBox: () => <input placeholder="Search all resources..." />,
  useSearchBox: () => mockUseSearchBox(),
  useHits: () => mockUseHits(),
  useInstantSearch: () => mockUseInstantSearch(),
}));

vi.mock("@/lib/algolia", () => ({
  getSearchClient: () => ({}),
  RESOURCES_INDEX: "test_index",
}));

// Import after mocks are set up
const { ResourceSearch } = await import("./resource-search");

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("ResourceSearch", () => {
  it("shows error message when Algolia is in error state", () => {
    mockUseSearchBox.mockReturnValue({ query: "" });
    mockUseHits.mockReturnValue({ hits: [] });
    mockUseInstantSearch.mockReturnValue({
      status: "error",
      error: new Error("Index resources_articles does not exist"),
    });

    render(<ResourceSearch />);

    expect(
      screen.getByText(
        "Search is temporarily unavailable. Please browse categories instead."
      )
    ).toBeInTheDocument();
  });

  it("shows no results message when query matches nothing", () => {
    mockUseSearchBox.mockReturnValue({ query: "xyznonexistent" });
    mockUseHits.mockReturnValue({ hits: [] });
    mockUseInstantSearch.mockReturnValue({ status: "idle", error: undefined });

    render(<ResourceSearch />);

    expect(screen.getByText(/no articles match/i)).toBeInTheDocument();
  });

  it("shows nothing when query is too short and no error", () => {
    mockUseSearchBox.mockReturnValue({ query: "a" });
    mockUseHits.mockReturnValue({ hits: [] });
    mockUseInstantSearch.mockReturnValue({ status: "idle", error: undefined });

    render(<ResourceSearch />);

    expect(screen.queryByText(/result/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/temporarily unavailable/i)).not.toBeInTheDocument();
  });

  it("renders search results when hits are returned", () => {
    mockUseSearchBox.mockReturnValue({ query: "safeguarding" });
    mockUseHits.mockReturnValue({
      hits: [
        {
          objectID: "abc_0",
          title: "Safeguarding Policy",
          slug: "safeguarding-policy",
          sectionHeading: "Introduction",
          sectionSlug: "introduction",
          categoryName: "Policies",
          _snippetResult: {
            content: {
              value: "This is the <mark>safeguarding</mark> policy.",
            },
          },
        },
      ],
    });
    mockUseInstantSearch.mockReturnValue({ status: "idle", error: undefined });

    render(<ResourceSearch />);

    expect(screen.getByText("1 result")).toBeInTheDocument();
    expect(screen.getByText("Safeguarding Policy")).toBeInTheDocument();
  });
});
