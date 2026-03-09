"use client";

import { type ColumnDef } from "@tanstack/react-table";

/**
 * Creates a row number column definition for use with DataTable.
 * Numbers are pagination-aware: (page * pageSize) + row.index + 1.
 */
export function createRowNumberColumn<TData>(): ColumnDef<TData> {
  return {
    id: "rowNumber",
    header: () => (
      <span className="text-muted-foreground">#</span>
    ),
    cell: ({ row, table }) => {
      const pageIndex = table.getState().pagination.pageIndex;
      const pageSize = table.getState().pagination.pageSize;
      return (
        <span className="text-muted-foreground tabular-nums">
          {pageIndex * pageSize + row.index + 1}
        </span>
      );
    },
    enableSorting: false,
    enableHiding: false,
    size: 48,
    meta: {
      headerClassName: "w-12",
      cellClassName: "w-12",
    },
  };
}
