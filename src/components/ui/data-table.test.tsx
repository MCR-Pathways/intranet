import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ColumnDef } from "@tanstack/react-table";

import { DataTable } from "./data-table";
import { DataTableColumnHeader } from "./data-table-column-header";
import { createRowNumberColumn } from "./data-table-row-number";

// --- Test data ---

interface TestItem {
  id: number;
  name: string;
  status: string;
  amount: number;
}

const testData: TestItem[] = [
  { id: 1, name: "Alice", status: "Active", amount: 100 },
  { id: 2, name: "Bob", status: "Pending", amount: 200 },
  { id: 3, name: "Charlie", status: "Active", amount: 50 },
  { id: 4, name: "Diana", status: "Inactive", amount: 300 },
  { id: 5, name: "Edward", status: "Active", amount: 150 },
];

const columns: ColumnDef<TestItem>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
  },
];

// --- Tests ---

describe("DataTable", () => {
  it("renders table with data", () => {
    render(<DataTable columns={columns} data={testData} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getAllByText("Active")).toHaveLength(3);
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyMessage="No items found"
      />
    );

    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("renders default empty message", () => {
    render(<DataTable columns={columns} data={[]} />);

    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    render(<DataTable columns={columns} data={testData} />);

    // Sortable columns render as buttons with the title text
    expect(screen.getByRole("button", { name: /name/i })).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /amount/i })
    ).toBeInTheDocument();
  });

  it("shows search input when searchKey is provided", () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        searchKey="name"
        searchPlaceholder="Search by name..."
      />
    );

    expect(
      screen.getByPlaceholderText("Search by name...")
    ).toBeInTheDocument();
  });

  it("does not show search input when searchKey is not provided", () => {
    render(<DataTable columns={columns} data={testData} />);

    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
  });

  it("filters data when searching", async () => {
    const user = userEvent.setup();

    render(
      <DataTable
        columns={columns}
        data={testData}
        searchKey="name"
        searchPlaceholder="Search..."
      />
    );

    const searchInput = screen.getByPlaceholderText("Search...");
    await user.type(searchInput, "Alice");

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("sorts data when clicking a sortable column header", async () => {
    const user = userEvent.setup();

    render(<DataTable columns={columns} data={testData} />);

    const nameHeader = screen.getByRole("button", { name: /name/i });

    // Click to sort ascending
    await user.click(nameHeader);

    const rows = screen.getAllByRole("row");
    // First row is header, data rows start at index 1
    const firstDataRow = rows[1];
    expect(within(firstDataRow).getByText("Alice")).toBeInTheDocument();

    // Click again to sort descending
    await user.click(nameHeader);

    const rowsAfter = screen.getAllByRole("row");
    const firstDataRowAfter = rowsAfter[1];
    expect(within(firstDataRowAfter).getByText("Edward")).toBeInTheDocument();
  });

  it("returns to unsorted state on third click (three-state cycling)", async () => {
    const user = userEvent.setup();

    render(<DataTable columns={columns} data={testData} />);

    const amountHeader = screen.getByRole("button", { name: /amount/i });

    // Original order: 100, 200, 50, 300, 150
    const getFirstRowText = () => {
      const rows = screen.getAllByRole("row");
      return rows[1].textContent;
    };

    // TanStack sorts numeric columns descending first by default
    // Click 1: unsorted → descending (300 first)
    await user.click(amountHeader);
    expect(getFirstRowText()).toContain("300");

    // Click 2: descending → ascending (50 first)
    await user.click(amountHeader);
    expect(getFirstRowText()).toContain("50");

    // Click 3: ascending → unsorted (back to original order, Alice/100 first)
    await user.click(amountHeader);
    expect(getFirstRowText()).toContain("Alice");
  });

  it("shows result count in footer", () => {
    render(<DataTable columns={columns} data={testData} />);

    expect(screen.getByText("Showing 5 results")).toBeInTheDocument();
  });

  it("shows singular result count", () => {
    render(<DataTable columns={columns} data={[testData[0]]} />);

    expect(screen.getByText("Showing 1 result")).toBeInTheDocument();
  });

  it("shows pagination when data exceeds pageSize", () => {
    // Generate more data than default pageSize of 10
    const moreData = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `Person ${i + 1}`,
      status: "Active",
      amount: (i + 1) * 10,
    }));

    render(<DataTable columns={columns} data={moreData} pageSize={10} />);

    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText(/Rows per page/)).toBeInTheDocument();
  });

  it("does not show pagination when data fits in one page", () => {
    render(<DataTable columns={columns} data={testData} pageSize={10} />);

    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rows per page/)).not.toBeInTheDocument();
  });

  it("renders toolbar content when provided", () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        toolbar={<button>Export CSV</button>}
      />
    );

    expect(
      screen.getByRole("button", { name: "Export CSV" })
    ).toBeInTheDocument();
  });

  it("calls onRowClick when a row is clicked", async () => {
    const user = userEvent.setup();
    const handleRowClick = vi.fn();

    render(
      <DataTable
        columns={columns}
        data={testData}
        onRowClick={handleRowClick}
      />
    );

    // Click on Alice's row
    await user.click(screen.getByText("Alice"));

    expect(handleRowClick).toHaveBeenCalledWith(testData[0]);
  });

  it("applies cursor-pointer class when onRowClick is provided", () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        onRowClick={() => {}}
      />
    );

    const rows = screen.getAllByRole("row");
    // Data rows (skip header row at index 0)
    expect(rows[1]).toHaveClass("cursor-pointer");
  });

  it("does not apply cursor-pointer when onRowClick is not provided", () => {
    render(<DataTable columns={columns} data={testData} />);

    const rows = screen.getAllByRole("row");
    expect(rows[1]).not.toHaveClass("cursor-pointer");
  });
});

describe("DataTableColumnHeader", () => {
  it("renders as plain text when column is not sortable", () => {
    render(<DataTable columns={columns} data={testData} />);

    // "Status" column has enableSorting: false
    const statusHeader = screen.getByText("Status");
    // Should not be a button
    expect(statusHeader.tagName).not.toBe("BUTTON");
  });

  it("renders as button when column is sortable", () => {
    render(<DataTable columns={columns} data={testData} />);

    // "Name" uses DataTableColumnHeader
    const nameButton = screen.getByRole("button", { name: /name/i });
    expect(nameButton).toBeInTheDocument();
  });
});

describe("createRowNumberColumn", () => {
  it("renders sequential row numbers", () => {
    const columnsWithNumber: ColumnDef<TestItem>[] = [
      createRowNumberColumn<TestItem>(),
      ...columns,
    ];

    render(<DataTable columns={columnsWithNumber} data={testData} />);

    // Check header
    expect(screen.getByText("#")).toBeInTheDocument();

    // Check row numbers
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("respects pagination for row numbers", () => {
    const moreData = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `Person ${i + 1}`,
      status: "Active",
      amount: (i + 1) * 10,
    }));

    const columnsWithNumber: ColumnDef<TestItem>[] = [
      createRowNumberColumn<TestItem>(),
      ...columns,
    ];

    render(
      <DataTable columns={columnsWithNumber} data={moreData} pageSize={10} />
    );

    // First page should show rows 1-10
    // Row numbers are inside spans with tabular-nums class
    const rowNumbers = screen.getAllByText(/^\d+$/).filter(
      (el) => el.classList.contains("tabular-nums")
    );
    expect(rowNumbers).toHaveLength(10);
    expect(rowNumbers[0]).toHaveTextContent("1");
    expect(rowNumbers[9]).toHaveTextContent("10");
  });
});

describe("Table primitives", () => {
  it("table has correct sticky header classes", () => {
    render(<DataTable columns={columns} data={testData} />);

    const thElements = document.querySelectorAll("th");
    thElements.forEach((th) => {
      expect(th.className).toContain("sticky");
      expect(th.className).toContain("top-0");
    });
  });

  it("table uses border-separate for sticky header compatibility", () => {
    render(<DataTable columns={columns} data={testData} />);

    const table = document.querySelector("table");
    expect(table?.className).toContain("border-separate");
    expect(table?.className).toContain("border-spacing-0");
  });

  it("rows have hover styling", () => {
    render(<DataTable columns={columns} data={testData} />);

    const rows = screen.getAllByRole("row");
    // Data rows have hover class
    expect(rows[1].className).toContain("hover:bg-muted/50");
  });
});
