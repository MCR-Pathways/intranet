"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

interface DataTableProps<TData, TValue> {
  /** Column definitions for the table. Memoise with useMemo in parent to avoid re-initialisation. */
  columns: ColumnDef<TData, TValue>[];
  /** Data array to display. Memoise with useMemo if derived from a transformation. */
  data: TData[];
  /** Key in the data to use for the global search filter */
  searchKey?: string;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Message to display when the table has no data */
  emptyMessage?: string;
  /** Whether to show pagination controls. Defaults to true when data.length > pageSize */
  showPagination?: boolean;
  /** Number of rows per page. Defaults to 10 */
  pageSize?: number;
  /** Additional content to render in the toolbar (e.g. filter dropdowns, action buttons) */
  toolbar?: React.ReactNode;
  /** Callback when a row is clicked */
  onRowClick?: (row: TData) => void;
  /** Initial sorting state */
  initialSorting?: SortingState;
  /** Initial column visibility */
  initialColumnVisibility?: VisibilityState;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  showPagination,
  pageSize = 10,
  toolbar,
  onRowClick,
  initialSorting = [],
  initialColumnVisibility = {},
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialColumnVisibility);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  const shouldShowPagination =
    showPagination ?? data.length > pageSize;

  const filteredRowCount = table.getFilteredRowModel().rows.length;

  return (
    <div className="space-y-4">
      {/* Toolbar: search + custom controls */}
      {(searchKey || toolbar) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {searchKey && (
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={
                  (table.getColumn(searchKey)?.getFilterValue() as string) ?? ""
                }
                onChange={(event) =>
                  table.getColumn(searchKey)?.setFilterValue(event.target.value)
                }
                className="pl-9"
              />
            </div>
          )}
          {toolbar}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={
                    onRowClick
                      ? () => onRowClick(row.original)
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer: result count + pagination */}
      <div className="flex items-center justify-between">
        {!shouldShowPagination && (
          <p className="text-xs text-muted-foreground">
            Showing {filteredRowCount} result
            {filteredRowCount !== 1 ? "s" : ""}
          </p>
        )}
        {shouldShowPagination && <DataTablePagination table={table} />}
      </div>
    </div>
  );
}
