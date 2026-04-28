import { Link, useLoaderData, useFetcher } from "react-router"
import { data } from "react-router"
import type { Route } from "./+types/forms.$formId.submissions"
import { createColumns } from "./forms.$formId.submissions/columns"
import type { Submission } from "./forms.$formId.submissions/columns"
import { DataTable } from "./forms.$formId.submissions/data-table"
import { DetailPanel } from "./forms.$formId.submissions/detail-panel"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Inbox, TrendingUp, TrendingDown, Download, Trash2, Star, Archive, MailOpen, MailCheck, ShieldAlert } from "lucide-react"
import type { ChartConfig } from "~/components/ui/chart"
import { requireAuth } from "~/lib/require-auth.server"
import { getVisibleSubmissionEntries } from "~/lib/submission-display"
import { useState, useCallback } from "react"

export const meta: Route.MetaFunction = () => {
  return [
    { title: `提交数据 | FormZero` },
    { name: "description", content: "查看和管理表单提交数据" },
  ];
};

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { formId } = params
  const database = context.cloudflare.env.DB

  await requireAuth(request, database, context.cloudflare.env)

  // Fetch all submissions for this form
  const submissions = await database
    .prepare(
      "SELECT id, form_id, data, created_at, is_read, is_starred, is_archived FROM submissions WHERE form_id = ? AND COALESCE(is_spam, 0) = 0 ORDER BY created_at DESC"
    )
    .bind(formId)
    .all()

  // Parse the JSON data field for each submission
  const parsedSubmissions: Submission[] = submissions.results.map((row: any) => ({
    id: row.id,
    form_id: row.form_id,
    data: JSON.parse(row.data),
    created_at: row.created_at,
    is_read: row.is_read ?? 0,
    is_starred: row.is_starred ?? 0,
    is_archived: row.is_archived ?? 0,
  }))

  // Calculate stats
  const total = parsedSubmissions.length
  const now = Date.now()
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000
  const twoMonthsAgo = now - 60 * 24 * 60 * 60 * 1000

  const thisWeek = parsedSubmissions.filter(
    (s) => s.created_at >= oneWeekAgo
  ).length
  const previousWeek = parsedSubmissions.filter(
    (s) => s.created_at >= twoWeeksAgo && s.created_at < oneWeekAgo
  ).length
  const thisMonth = parsedSubmissions.filter(
    (s) => s.created_at >= oneMonthAgo
  ).length
  const previousMonth = parsedSubmissions.filter(
    (s) => s.created_at >= twoMonthsAgo && s.created_at < oneMonthAgo
  ).length

  // Calculate trends
  const weekTrend = previousWeek === 0
    ? (thisWeek > 0 ? 100 : 0)
    : Math.round(((thisWeek - previousWeek) / previousWeek) * 100)
  const monthTrend = previousMonth === 0
    ? (thisMonth > 0 ? 100 : 0)
    : Math.round(((thisMonth - previousMonth) / previousMonth) * 100)

  // Calculate daily submissions for the past 30 days
  const dailySubmissions: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000)
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000

    const count = parsedSubmissions.filter(
      (s) => s.created_at >= startOfDay && s.created_at < endOfDay
    ).length

    dailySubmissions.push({
      date: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      count,
    })
  }

  return {
    submissions: parsedSubmissions,
    stats: { total, thisWeek, thisMonth, weekTrend, monthTrend },
    chartData: dailySubmissions,
  }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const database = context.cloudflare.env.DB
  await requireAuth(request, database, context.cloudflare.env)

  const formData = await request.formData()
  const intent = formData.get("intent")

  if (intent === "delete") {
    const ids = formData.getAll("ids") as string[]
    if (ids.length === 0) {
      return data({ error: "未选择提交数据" }, { status: 400 })
    }

    const placeholders = ids.map(() => "?").join(", ")
    await database
      .prepare(
        `DELETE FROM submissions WHERE id IN (${placeholders}) AND form_id = ?`
      )
      .bind(...ids, params.formId)
      .run()

    return data({ success: true, deleted: ids.length })
  }

  if (intent === "mark_read" || intent === "mark_unread") {
    const ids = formData.getAll("ids") as string[]
    if (ids.length === 0) return data({ error: "未选择提交数据" }, { status: 400 })
    const value = intent === "mark_read" ? 1 : 0
    const placeholders = ids.map(() => "?").join(", ")
    await database
      .prepare(`UPDATE submissions SET is_read = ? WHERE id IN (${placeholders}) AND form_id = ?`)
      .bind(value, ...ids, params.formId)
      .run()
    return data({ success: true })
  }

  if (intent === "mark_spam") {
    const ids = formData.getAll("ids") as string[]
    if (ids.length === 0) return data({ error: "未选择提交数据" }, { status: 400 })

    const placeholders = ids.map(() => "?").join(", ")
    await database
      .prepare(
        `UPDATE submissions SET is_spam = 1, is_archived = 0 WHERE id IN (${placeholders}) AND form_id = ?`
      )
      .bind(...ids, params.formId)
      .run()

    return data({ success: true, markedSpam: ids.length })
  }

  if (intent === "toggle_star") {
    const id = formData.get("id") as string
    if (!id) return data({ error: "缺少提交 ID" }, { status: 400 })
    const current = await database
      .prepare("SELECT is_starred FROM submissions WHERE id = ? AND form_id = ?")
      .bind(id, params.formId)
      .first<{ is_starred: number }>()
    const newValue = current?.is_starred ? 0 : 1
    await database
      .prepare("UPDATE submissions SET is_starred = ? WHERE id = ? AND form_id = ?")
      .bind(newValue, id, params.formId)
      .run()
    return data({ success: true, is_starred: newValue })
  }

  if (intent === "toggle_archive") {
    const id = formData.get("id") as string
    if (!id) return data({ error: "缺少提交 ID" }, { status: 400 })
    const current = await database
      .prepare("SELECT is_archived FROM submissions WHERE id = ? AND form_id = ?")
      .bind(id, params.formId)
      .first<{ is_archived: number }>()
    const newValue = current?.is_archived ? 0 : 1
    await database
      .prepare("UPDATE submissions SET is_archived = ? WHERE id = ? AND form_id = ?")
      .bind(newValue, id, params.formId)
      .run()
    return data({ success: true, is_archived: newValue })
  }

  return data({ error: "未知操作" }, { status: 400 })
}

const chartConfig = {
  count: {
    label: "提交数据",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export default function SubmissionsPage() {
  const { submissions, stats, chartData } = useLoaderData<typeof loader>()
  const fetcher = useFetcher()
  const statusFetcher = useFetcher()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detailSubmission, setDetailSubmission] = useState<Submission | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [filter, setFilter] = useState<"all" | "unread" | "starred" | "archived">("all")
  const [spamHiddenIds, setSpamHiddenIds] = useState<string[]>([])

  const visibleSubmissions = submissions.filter((s) => !spamHiddenIds.includes(s.id))

  // Filter submissions based on current filter
  const filteredSubmissions = visibleSubmissions.filter((s) => {
    if (filter === "unread") return !s.is_read
    if (filter === "starred") return s.is_starred
    if (filter === "archived") return s.is_archived
    return !s.is_archived // "all" hides archived by default
  })

  const unreadCount = visibleSubmissions.filter((s) => !s.is_read && !s.is_archived).length
  const starredCount = visibleSubmissions.filter((s) => s.is_starred).length
  const archivedCount = visibleSubmissions.filter((s) => s.is_archived).length

  const handleDeleteIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const formData = new FormData()
    formData.append("intent", "delete")
    ids.forEach((id) => formData.append("ids", id))
    fetcher.submit(formData, { method: "post" })
  }, [fetcher])

  const handleDeleteSingle = useCallback((id: string) => {
    handleDeleteIds([id])
  }, [handleDeleteIds])

  const handleMarkSpamIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const uniqueIds = Array.from(new Set(ids))
    setSpamHiddenIds((current) => Array.from(new Set([...current, ...uniqueIds])))
    setSelectedIds((current) => current.filter((id) => !uniqueIds.includes(id)))

    const formData = new FormData()
    formData.append("intent", "mark_spam")
    uniqueIds.forEach((id) => formData.append("ids", id))
    statusFetcher.submit(formData, { method: "post" })
  }, [statusFetcher])

  const handleMarkSpamSingle = useCallback((id: string) => {
    handleMarkSpamIds([id])
  }, [handleMarkSpamIds])

  const handleViewDetail = useCallback((submission: Submission) => {
    setDetailSubmission(submission)
    setDetailOpen(true)
    // Auto mark as read
    if (!submission.is_read) {
      const fd = new FormData()
      fd.append("intent", "mark_read")
      fd.append("ids", submission.id)
      statusFetcher.submit(fd, { method: "post" })
    }
  }, [statusFetcher])

  const handleToggleStar = useCallback((id: string) => {
    const fd = new FormData()
    fd.append("intent", "toggle_star")
    fd.append("id", id)
    statusFetcher.submit(fd, { method: "post" })
  }, [statusFetcher])

  const handleToggleArchive = useCallback((id: string) => {
    const fd = new FormData()
    fd.append("intent", "toggle_archive")
    fd.append("id", id)
    statusFetcher.submit(fd, { method: "post" })
  }, [statusFetcher])

  const handleMarkSelectedRead = () => {
    if (selectedIds.length === 0) return
    const fd = new FormData()
    fd.append("intent", "mark_read")
    selectedIds.forEach((id) => fd.append("ids", id))
    statusFetcher.submit(fd, { method: "post" })
  }

  // Generate columns based on submission data
  const columns = createColumns(filteredSubmissions, {
    onView: handleViewDetail,
    onDelete: handleDeleteSingle,
    onToggleStar: handleToggleStar,
    onToggleArchive: handleToggleArchive,
    onMarkSpam: handleMarkSpamSingle,
  })

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return
    if (!confirm(`确定要删除这 ${selectedIds.length} 条提交数据吗？此操作不可撤销。`)) return
    handleDeleteIds(selectedIds)
    setSelectedIds([])
  }

  const handleMarkSelectedSpam = () => {
    if (selectedIds.length === 0) return
    handleMarkSpamIds(selectedIds)
  }

  const exportToCSV = () => {
    if (visibleSubmissions.length === 0) return

    // Helper to escape CSV values
    const escapeCSV = (value: any) => {
      const stringValue = value !== undefined && value !== null ? String(value) : ''
      // Always wrap in quotes if contains comma, quote, or newline
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }

    // Get all unique keys from all submissions
    const allKeys = new Set<string>()
    visibleSubmissions.forEach(sub => {
      getVisibleSubmissionEntries(sub.data).forEach(([key]) => allKeys.add(key))
    })
    const dataKeys = Array.from(allKeys).sort()

    // Create CSV headers
    const headers = ['ID', 'Created At', ...dataKeys]

    // Create CSV rows
    const rows = visibleSubmissions.map(sub => {
      const date = new Date(sub.created_at).toLocaleString()
      const dataValues = dataKeys.map(key => escapeCSV(sub.data[key]))
      return [escapeCSV(sub.id), escapeCSV(date), ...dataValues].join(',')
    })

    // Combine headers and rows
    const csv = [headers.join(','), ...rows].join('\n')

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `submissions-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0">
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 min-w-0">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground">总提交数</h3>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground">本周</h3>
          <div className="flex items-end gap-2 mt-1">
            <p className="text-2xl font-bold">{stats.thisWeek}</p>
            <div className={`flex items-center gap-1 text-xs font-medium pb-0.5 ${stats.weekTrend > 0 ? 'text-green-600 dark:text-green-500' : stats.weekTrend < 0 ? 'text-red-600 dark:text-red-500' : 'text-muted-foreground'}`}>
              {stats.weekTrend > 0 ? <TrendingUp className="h-3 w-3" /> : stats.weekTrend < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              <span>{stats.weekTrend > 0 ? '+' : ''}{stats.weekTrend}%</span>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground">本月</h3>
          <div className="flex items-end gap-2 mt-1">
            <p className="text-2xl font-bold">{stats.thisMonth}</p>
            <div className={`flex items-center gap-1 text-xs font-medium pb-0.5 ${stats.monthTrend > 0 ? 'text-green-600 dark:text-green-500' : stats.monthTrend < 0 ? 'text-red-600 dark:text-red-500' : 'text-muted-foreground'}`}>
              {stats.monthTrend > 0 ? <TrendingUp className="h-3 w-3" /> : stats.monthTrend < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              <span>{stats.monthTrend > 0 ? '+' : ''}{stats.monthTrend}%</span>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">近 30 天</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ChartContainer config={chartConfig} className="h-[140px] w-full">
            <LineChart accessibilityLayer data={chartData} margin={{ left: -20, right: 10 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="linear"
                dataKey="count"
                stroke="var(--color-count)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Filter tabs */}
      {visibleSubmissions.length > 0 && (
        <div className="flex items-center gap-1 border-b pb-2">
          <Button
            variant={filter === "all" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => { setFilter("all"); setSelectedIds([]) }}
          >
            <Inbox className="h-3.5 w-3.5" />
            全部
          </Button>
          <Button
            variant={filter === "unread" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => { setFilter("unread"); setSelectedIds([]) }}
          >
            <MailOpen className="h-3.5 w-3.5" />
            未读
            {unreadCount > 0 && (
              <span className="ml-0.5 rounded-full bg-blue-500 text-white text-[10px] leading-none px-1.5 py-0.5">
                {unreadCount}
              </span>
            )}
          </Button>
          <Button
            variant={filter === "starred" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => { setFilter("starred"); setSelectedIds([]) }}
          >
            <Star className="h-3.5 w-3.5" />
            星标
            {starredCount > 0 && (
              <span className="ml-0.5 text-muted-foreground">{starredCount}</span>
            )}
          </Button>
          <Button
            variant={filter === "archived" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => { setFilter("archived"); setSelectedIds([]) }}
          >
            <Archive className="h-3.5 w-3.5" />
            归档
            {archivedCount > 0 && (
              <span className="ml-0.5 text-muted-foreground">{archivedCount}</span>
            )}
          </Button>
        </div>
      )}

      {visibleSubmissions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center min-w-0 py-12">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox className="h-10 w-10" />
              </EmptyMedia>
              <EmptyTitle>暂无提交数据</EmptyTitle>
              <EmptyDescription>
                向此表单发送第一条提交数据开始使用。
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to="../integration">去集成</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredSubmissions}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onRowClick={handleViewDetail}
          headerAction={
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkSelectedRead}
                    className="h-9 gap-1.5 text-xs"
                  >
                    <MailCheck className="h-3 w-3" />
                    标为已读
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkSelectedSpam}
                    className="h-9 gap-1.5 text-xs"
                  >
                    <ShieldAlert className="h-3 w-3" />
                    标为垃圾邮件
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSelected}
                    disabled={fetcher.state === "submitting"}
                    className="h-9 gap-1.5 text-xs"
                  >
                    <Trash2 className="h-3 w-3" />
                    删除 {selectedIds.length}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="h-9 gap-1.5 text-xs"
              >
                <Download className="h-3 w-3" />
                导出 CSV
              </Button>
            </div>
          }
        />
      )}

      <DetailPanel
        submission={detailSubmission}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDelete={handleDeleteSingle}
        onToggleStar={handleToggleStar}
        onToggleArchive={handleToggleArchive}
        onMarkSpam={handleMarkSpamSingle}
        isDeleting={fetcher.state === "submitting"}
      />
    </div>
  )
}
