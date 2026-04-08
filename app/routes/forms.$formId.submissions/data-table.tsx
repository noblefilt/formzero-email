import * as React from "react"
import type {
  ColumnDef,
  SortingState,
} from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table"
import { Input } from "~/components/ui/input"

interface DataTableProps<TData extends { id: string }, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  headerAction?: React.ReactNode
  selectedIds?: string[]
  onSelectedIdsChange?: (ids: string[]) => void
  onRowClick?: (row: TData) => void
}

export function DataTable<TData extends { id: string }, TValue>({
  columns,
  data,
  headerAction,
  selectedIds = [],
  onSelectedIdsChange,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "created_at", desc: true }, // Default sort by created_at descending
  ])
  const [searchQuery, setSearchQuery] = React.useState("")

  // Filter data based on search query across all fields
  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim()) return data

    const query = searchQuery.toLowerCase()
    return data.filter((item) => {
      // Search across all values in the object
      const searchableString = JSON.stringify(item).toLowerCase()
      return searchableString.includes(query)
    })
  }, [data, searchQuery])

  const allFilteredIds = filteredData.map((item) => item.id)
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.includes(id))
  const someSelected = selectedIds.length > 0 && !allSelected

  const toggleAll = () => {
    if (allSelected) {
      onSelectedIdsChange?.([])
    } else {
      onSelectedIdsChange?.(allFilteredIds)
    }
  }

  const toggleRow = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange?.(selectedIds.filter((s) => s !== id))
    } else {
      onSelectedIdsChange?.([...selectedIds, id])
    }
  }

  const table = useReactTable({
    data: filteredData,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  })

  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="搜索提交数据..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        {headerAction && <div className="flex items-center gap-2">{headerAction}</div>}
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {onSelectedIdsChange && (
                  <TableHead className="w-10 px-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected }}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableHead>
                )}
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const rowId = (row.original as any).id as string
                const isSelected = selectedIds.includes(rowId)
                return (
                  <TableRow
                    key={row.id}
                    data-state={isSelected ? "selected" : undefined}
                    className={`${isSelected ? "bg-muted/50" : ""} ${onRowClick ? "cursor-pointer hover:bg-muted/30" : ""}`}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {onSelectedIdsChange && (
                      <TableCell className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(rowId)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (onSelectedIdsChange ? 1 : 0)}
                  className="h-24 text-center"
                >
                  暂无提交数据。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-muted-foreground text-sm">
        {selectedIds.length > 0
          ? `已选择 ${selectedIds.length} / ${data.length} 条`
          : filteredData.length === data.length
            ? `共 ${data.length} 条提交数据`
            : `显示 ${filteredData.length} / ${data.length} 条`}
      </div>
    </div>
  )
}
