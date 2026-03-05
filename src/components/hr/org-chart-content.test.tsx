import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrgChartContent, type OrgPerson } from "./org-chart-content";

// =============================================
// MOCKS
// =============================================

// Mock react-d3-tree (loaded via next/dynamic)
vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    // Return a dummy Tree component that renders its data for testing
    return function MockTree(props: {
      data: unknown;
    }) {
      return <div data-testid="mock-tree" data-tree-data={JSON.stringify(props.data)} />;
    };
  },
}));

// Mock d3-selection and d3-zoom (used by zoom helpers)
vi.mock("d3-selection", () => ({
  select: vi.fn(() => ({
    property: vi.fn().mockReturnThis(),
    select: vi.fn(() => ({ attr: vi.fn() })),
  })),
}));

vi.mock("d3-zoom", () => ({
  zoomIdentity: {
    translate: vi.fn().mockReturnThis(),
    scale: vi.fn().mockReturnThis(),
    k: 1,
    x: 0,
    y: 0,
  },
}));

// Mock DEPARTMENT_CONFIG
vi.mock("@/lib/hr", () => ({
  DEPARTMENT_CONFIG: {
    executive: { label: "Executive", colour: "#1e293b" },
    delivery: { label: "Delivery", colour: "#15803d" },
    people: { label: "People", colour: "#7c3aed" },
    finance: { label: "Finance", colour: "#b45309" },
  } as Record<string, { label: string; colour: string }>,
}));

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// jsdom has 0 clientWidth/clientHeight — mock them so the tree renders (translate.x > 0 guard)
Object.defineProperty(HTMLDivElement.prototype, "clientWidth", { value: 800, writable: true });
Object.defineProperty(HTMLDivElement.prototype, "clientHeight", { value: 600, writable: true });

// =============================================
// TEST DATA
// =============================================

function createTestPeople(): OrgPerson[] {
  return [
    {
      id: "ceo",
      full_name: "Jane Thomson",
      job_title: "Chief Executive",
      avatar_url: null,
      department: "executive",
      region: "west",
      line_manager_id: null,
      is_line_manager: true,
      is_external: false,
      fte: 1,
    },
    {
      id: "director-delivery",
      full_name: "Robert Campbell",
      job_title: "Director of Delivery",
      avatar_url: null,
      department: "delivery",
      region: "west",
      line_manager_id: "ceo",
      is_line_manager: true,
      is_external: false,
      fte: 1,
    },
    {
      id: "director-people",
      full_name: "Alice Fraser",
      job_title: "People Director",
      avatar_url: null,
      department: "people",
      region: "west",
      line_manager_id: "ceo",
      is_line_manager: true,
      is_external: false,
      fte: 1,
    },
    {
      id: "pm-1",
      full_name: "David Wilson",
      job_title: "Programme Manager",
      avatar_url: null,
      department: "delivery",
      region: "west",
      line_manager_id: "director-delivery",
      is_line_manager: false,
      is_external: false,
      fte: 0.8,
    },
    {
      id: "ext-1",
      full_name: "Fatima Ali",
      job_title: "Pathways Coordinator",
      avatar_url: null,
      department: "delivery",
      region: "west",
      line_manager_id: "director-delivery",
      is_line_manager: false,
      is_external: true,
      fte: 1,
    },
    {
      id: "hr-officer",
      full_name: "Karen MacDonald",
      job_title: "HR Officer",
      avatar_url: null,
      department: "people",
      region: "west",
      line_manager_id: "director-people",
      is_line_manager: false,
      is_external: false,
      fte: 0.6,
    },
  ];
}

const defaultProps = {
  people: createTestPeople(),
  onLeaveIds: [] as string[],
  currentUserId: "pm-1",
};

describe("OrgChartContent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================
  // RENDERING
  // =============================================

  it("renders the page header with people count", () => {
    render(<OrgChartContent {...defaultProps} />);

    expect(screen.getByText("Org Chart")).toBeInTheDocument();
    expect(
      screen.getByText("6 people across the organisation")
    ).toBeInTheDocument();
  });

  it("renders the tree component", () => {
    render(<OrgChartContent {...defaultProps} />);

    expect(screen.getByTestId("mock-tree")).toBeInTheDocument();
  });

  it("renders empty state when no people", () => {
    render(<OrgChartContent {...defaultProps} people={[]} />);

    expect(screen.getByText("No organisation data")).toBeInTheDocument();
    expect(
      screen.getByText("No active staff profiles found.")
    ).toBeInTheDocument();
  });

  // =============================================
  // DEPARTMENT LEGEND
  // =============================================

  it("renders department legend with active departments", () => {
    render(<OrgChartContent {...defaultProps} />);

    // Our test data has executive, delivery, people departments
    expect(screen.getByText("Executive")).toBeInTheDocument();
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expect(screen.getByText("People")).toBeInTheDocument();
  });

  it("does not show departments not present in data", () => {
    render(<OrgChartContent {...defaultProps} />);

    // Finance is in DEPARTMENT_CONFIG but not in test data
    // The legend only shows departments that exist in the people data
    const legend = screen.queryByText("Finance");
    expect(legend).not.toBeInTheDocument();
  });

  // =============================================
  // SEARCH
  // =============================================

  it("renders search input", () => {
    render(<OrgChartContent {...defaultProps} />);

    expect(
      screen.getByPlaceholderText("Search by name or title...")
    ).toBeInTheDocument();
  });

  it("shows match count when search finds results", () => {
    render(<OrgChartContent {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search by name or title...");
    fireEvent.change(input, { target: { value: "David" } });

    expect(screen.getByText("Found 1 match:")).toBeInTheDocument();
    expect(screen.getByText("David Wilson")).toBeInTheDocument();
  });

  it("shows no-match message when search finds nothing", () => {
    render(<OrgChartContent {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search by name or title...");
    fireEvent.change(input, { target: { value: "zzzzz" } });

    expect(
      screen.getByText(/No matches found for/)
    ).toBeInTheDocument();
  });

  it("matches by job title", () => {
    render(<OrgChartContent {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search by name or title...");
    fireEvent.change(input, { target: { value: "HR Officer" } });

    expect(screen.getByText("Found 1 match:")).toBeInTheDocument();
    expect(screen.getByText("Karen MacDonald")).toBeInTheDocument();
  });

  it("shows plural match count for multiple results", () => {
    render(<OrgChartContent {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search by name or title...");
    // "Director" matches both Robert Campbell and Alice Fraser
    fireEvent.change(input, { target: { value: "Director" } });

    expect(screen.getByText("Found 2 matches:")).toBeInTheDocument();
    expect(screen.getByText("(+1 more)")).toBeInTheDocument();
  });

  it("shows clear button when search has input", () => {
    render(<OrgChartContent {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search by name or title...");
    fireEvent.change(input, { target: { value: "test" } });

    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
  });

  it("clears search when clear button is clicked", () => {
    render(<OrgChartContent {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search by name or title...");
    fireEvent.change(input, { target: { value: "test" } });

    fireEvent.click(screen.getByLabelText("Clear search"));

    expect(input).toHaveValue("");
  });

  // =============================================
  // TOOLBAR BUTTONS
  // =============================================

  it("renders Find Me button", () => {
    render(<OrgChartContent {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /Find Me/ })
    ).toBeInTheDocument();
  });

  it("Find Me searches for current user", () => {
    render(<OrgChartContent {...defaultProps} currentUserId="pm-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Find Me/ }));

    const input = screen.getByPlaceholderText("Search by name or title...");
    expect(input).toHaveValue("David Wilson");
  });

  it("renders Expand/Collapse toggle", () => {
    render(<OrgChartContent {...defaultProps} />);

    // Initially expanded, so shows Collapse
    expect(
      screen.getByRole("button", { name: /Collapse/ })
    ).toBeInTheDocument();
  });

  it("toggles expand/collapse text", () => {
    render(<OrgChartContent {...defaultProps} />);

    // Click to collapse
    fireEvent.click(screen.getByRole("button", { name: /Collapse/ }));
    expect(
      screen.getByRole("button", { name: /Expand All/ })
    ).toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByRole("button", { name: /Expand All/ }));
    expect(
      screen.getByRole("button", { name: /Collapse/ })
    ).toBeInTheDocument();
  });

  // =============================================
  // ZOOM CONTROLS
  // =============================================

  it("renders zoom controls", () => {
    render(<OrgChartContent {...defaultProps} />);

    expect(screen.getByLabelText("Zoom in")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom out")).toBeInTheDocument();
    expect(screen.getByLabelText("Fit to screen")).toBeInTheDocument();
  });

  // =============================================
  // DEPARTMENT FILTER
  // =============================================

  it("renders department filter select", () => {
    render(<OrgChartContent {...defaultProps} />);

    // Radix Select renders a combobox
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  // =============================================
  // ACCESSIBILITY
  // =============================================

  it("renders chart container with correct aria attributes", () => {
    render(<OrgChartContent {...defaultProps} />);

    const chart = screen.getByRole("img");
    expect(chart).toHaveAttribute(
      "aria-label",
      "Organisation chart showing 6 staff members"
    );
    expect(chart).toHaveAttribute("aria-roledescription", "organisation chart");
  });

  // =============================================
  // KEYBOARD HINT
  // =============================================

  it("renders keyboard hint text", () => {
    render(<OrgChartContent {...defaultProps} />);

    expect(
      screen.getByText("Scroll to zoom · Drag to pan · Click card to view profile")
    ).toBeInTheDocument();
  });

  // =============================================
  // TREE DATA STRUCTURE
  // =============================================

  it("builds correct tree data with root node", () => {
    render(<OrgChartContent {...defaultProps} />);

    const tree = screen.getByTestId("mock-tree");
    const treeData = JSON.parse(tree.getAttribute("data-tree-data") || "{}");

    // Single root: Jane Thomson (CEO)
    expect(treeData.name).toBe("Jane Thomson");
    expect(treeData.attributes.personId).toBe("ceo");
    expect(treeData.attributes.jobTitle).toBe("Chief Executive");
  });

  it("builds tree with correct hierarchy", () => {
    render(<OrgChartContent {...defaultProps} />);

    const tree = screen.getByTestId("mock-tree");
    const treeData = JSON.parse(tree.getAttribute("data-tree-data") || "{}");

    // CEO should have 2 direct children (directors)
    expect(treeData.children).toHaveLength(2);

    const directorNames = treeData.children.map(
      (c: { name: string }) => c.name
    );
    expect(directorNames).toContain("Robert Campbell");
    expect(directorNames).toContain("Alice Fraser");
  });

  it("includes total report count in tree data", () => {
    render(<OrgChartContent {...defaultProps} />);

    const tree = screen.getByTestId("mock-tree");
    const treeData = JSON.parse(tree.getAttribute("data-tree-data") || "{}");

    // CEO has 5 total reports (2 directors + 2 under delivery + 1 under people)
    expect(treeData.attributes.totalReportCount).toBe(5);
    expect(treeData.attributes.directReportCount).toBe(2);
  });
});
