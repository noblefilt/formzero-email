import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Eye, Trash2, Star, Archive, ArchiveRestore, ShieldAlert } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Button } from "#/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip"
import {
  getSubmissionFieldLabel,
  getVisibleSubmissionEntries,
  normalizeSubmissionFieldKey,
} from "~/lib/submission-display"

export type Submission = {
  id: string
  form_id: string
  data: Record<string, any>
  created_at: number
  is_read: number
  is_starred: number
  is_archived: number
}

export function createColumns(
  submissions: Submission[],
  options?: {
    onView?: (submission: Submission) => void
    onDelete?: (id: string) => void
    onToggleStar?: (id: string) => void
    onToggleArchive?: (id: string) => void
    onMarkSpam?: (id: string) => void
  }
): ColumnDef<Submission>[] {
  // Time column comes first
  const timeColumn: ColumnDef<Submission> = {
    accessorKey: "created_at",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          时间
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const timestamp = row.getValue("created_at") as number
      const submission = row.original
      const date = new Date(timestamp)
      const relativeTime = formatDistanceToNow(date, {
        addSuffix: true,
        locale: zhCN,
      })
      const exactTime = date.toLocaleString('zh-CN', {
        dateStyle: "medium",
        timeStyle: "medium",
      })
      return (
        <TooltipProvider delayDuration={1000}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`text-sm flex items-center gap-1.5 ${!submission.is_read ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                {!submission.is_read && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                {relativeTime}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{exactTime}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
  }

  // Extract all unique field names from submission data
  const fieldNames = new Set<string>()
  submissions.forEach((submission) => {
    getVisibleSubmissionEntries(submission.data).forEach(([key]) => {
      fieldNames.add(key)
    })
  })

  // Sort field names: email first if exists, then alphabetically
  const sortedFields = Array.from(fieldNames).sort((a, b) => {
    if (normalizeSubmissionFieldKey(a) === "email") return -1
    if (normalizeSubmissionFieldKey(b) === "email") return 1
    return a.localeCompare(b)
  })

  // Create columns for each field
  const dataColumns: ColumnDef<Submission>[] = sortedFields.map((fieldName) => {
    // Make email column sortable
    if (normalizeSubmissionFieldKey(fieldName) === "email") {
      return {
        id: fieldName,
        accessorFn: (row) => row.data[fieldName],
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              {getSubmissionFieldLabel(fieldName)}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const value = row.original.data[fieldName]
          return <div className="text-sm">{value?.toString() || ""}</div>
        },
      }
    }

    // Regular columns
    return {
      id: fieldName,
      accessorFn: (row) => row.data[fieldName],
      header: getSubmissionFieldLabel(fieldName),
      cell: ({ row }) => {
        const value = row.original.data[fieldName]
        return <div className="text-sm">{value?.toString() || ""}</div>
      },
    }
  })

  // Star column
  const starColumn: ColumnDef<Submission> = {
    id: "star",
    header: "",
    cell: ({ row }) => {
      const submission = row.original
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={(e) => {
            e.stopPropagation()
            options?.onToggleStar?.(submission.id)
          }}
        >
          <Star className={`h-4 w-4 ${submission.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`} />
        </Button>
      )
    },
  }

  const spamColumn: ColumnDef<Submission> = {
    id: "spam",
    header: "",
    cell: ({ row }) => {
      const submission = row.original
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-destructive"
          aria-label="标为垃圾邮件"
          title="标为垃圾邮件"
          onClick={(e) => {
            e.stopPropagation()
            options?.onMarkSpam?.(submission.id)
          }}
        >
          <ShieldAlert className="h-4 w-4" />
        </Button>
      )
    },
  }

  // Action column
  const actionColumn: ColumnDef<Submission> = {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const submission = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">打开菜单</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => options?.onView?.(submission)}>
              <Eye className="mr-2 h-4 w-4" />
              查看详情
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => options?.onToggleArchive?.(submission.id)}>
              {submission.is_archived ? (
                <><ArchiveRestore className="mr-2 h-4 w-4" />取消归档</>
              ) : (
                <><Archive className="mr-2 h-4 w-4" />归档</>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (confirm("确定要删除此提交数据吗？")) {
                  options?.onDelete?.(submission.id)
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  }

  return [starColumn, spamColumn, timeColumn, ...dataColumns, actionColumn]
}
