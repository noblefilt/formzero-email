import { useLoaderData, Link } from "react-router"
import type { Route } from "./+types/forms.dashboard"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "~/components/ui/chart"
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Bar, BarChart } from "recharts"
import { TrendingUp, TrendingDown, FileText } from "lucide-react"
import type { ChartConfig } from "~/components/ui/chart"
import { requireAuth } from "~/lib/require-auth.server"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { Separator } from "~/components/ui/separator"
import { SidebarTrigger } from "~/components/ui/sidebar"

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Dashboard | FormZero" },
    { name: "description", content: "Overview of all form submissions" },
  ];
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const database = context.cloudflare.env.DB

  await requireAuth(request, database)

  // Fetch all forms
  const formsResult = await database
    .prepare("SELECT id, name FROM forms ORDER BY created_at ASC")
    .all()
  const forms = formsResult.results as { id: string; name: string }[]

  // Fetch all submissions
  const submissionsResult = await database
    .prepare("SELECT id, form_id, created_at FROM submissions ORDER BY created_at DESC")
    .all()
  const submissions = submissionsResult.results as { id: string; form_id: string; created_at: number }[]

  const now = Date.now()
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000
  const twoMonthsAgo = now - 60 * 24 * 60 * 60 * 1000

  const total = submissions.length
  const thisWeek = submissions.filter((s) => s.created_at >= oneWeekAgo).length
  const previousWeek = submissions.filter((s) => s.created_at >= twoWeeksAgo && s.created_at < oneWeekAgo).length
  const thisMonth = submissions.filter((s) => s.created_at >= oneMonthAgo).length
  const previousMonth = submissions.filter((s) => s.created_at >= twoMonthsAgo && s.created_at < oneMonthAgo).length

  const weekTrend = previousWeek === 0
    ? (thisWeek > 0 ? 100 : 0)
    : Math.round(((thisWeek - previousWeek) / previousWeek) * 100)
  const monthTrend = previousMonth === 0
    ? (thisMonth > 0 ? 100 : 0)
    : Math.round(((thisMonth - previousMonth) / previousMonth) * 100)

  // Daily submissions for the past 30 days
  const dailySubmissions: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000)
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000

    const count = submissions.filter(
      (s) => s.created_at >= startOfDay && s.created_at < endOfDay
    ).length

    dailySubmissions.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count,
    })
  }

  // Per-form breakdown
  const perFormStats = forms.map((form) => {
    const formSubmissions = submissions.filter((s) => s.form_id === form.id)
    const formThisWeek = formSubmissions.filter((s) => s.created_at >= oneWeekAgo).length
    const formThisMonth = formSubmissions.filter((s) => s.created_at >= oneMonthAgo).length
    return {
      id: form.id,
      name: form.name,
      total: formSubmissions.length,
      thisWeek: formThisWeek,
      thisMonth: formThisMonth,
    }
  }).sort((a, b) => b.total - a.total)

  return {
    stats: { total, thisWeek, thisMonth, weekTrend, monthTrend, formCount: forms.length },
    chartData: dailySubmissions,
    perFormStats,
  }
}

const lineChartConfig = {
  count: {
    label: "Submissions",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

const barChartConfig = {
  total: {
    label: "Total",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export default function DashboardPage() {
  const { stats, chartData, perFormStats } = useLoaderData<typeof loader>()

  return (
    <>
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/">
                FormZero
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0 min-w-0">
      <div>
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Overview of all your forms and submissions</p>
      </div>

      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 min-w-0">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground">Total Forms</h3>
          <div className="flex items-end gap-2 mt-1">
            <p className="text-2xl font-bold">{stats.formCount}</p>
            <FileText className="h-4 w-4 text-muted-foreground mb-1" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground">Total Submissions</h3>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground">This Week</h3>
          <div className="flex items-end gap-2 mt-1">
            <p className="text-2xl font-bold">{stats.thisWeek}</p>
            <div className={`flex items-center gap-1 text-xs font-medium pb-0.5 ${stats.weekTrend > 0 ? 'text-green-600 dark:text-green-500' : stats.weekTrend < 0 ? 'text-red-600 dark:text-red-500' : 'text-muted-foreground'}`}>
              {stats.weekTrend > 0 ? <TrendingUp className="h-3 w-3" /> : stats.weekTrend < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              <span>{stats.weekTrend > 0 ? '+' : ''}{stats.weekTrend}%</span>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground">This Month</h3>
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
          <CardTitle className="text-base">All Submissions - Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ChartContainer config={lineChartConfig} className="h-[180px] w-full">
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

      {perFormStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Submissions per Form</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ChartContainer config={barChartConfig} className="h-[200px] w-full">
              <BarChart accessibilityLayer data={perFormStats} margin={{ left: -20, right: 10 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  tickMargin={8}
                  axisLine={false}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  allowDecimals={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="total"
                  fill="var(--color-total)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {perFormStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Form Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Form</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Total</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">This Week</th>
                    <th className="text-right py-2 pl-4 font-medium text-muted-foreground">This Month</th>
                  </tr>
                </thead>
                <tbody>
                  {perFormStats.map((form) => (
                    <tr key={form.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors">
                      <td className="py-2 pr-4 font-medium">
                        <Link to={`/forms/${form.id}/submissions`} className="hover:underline">
                          {form.name}
                        </Link>
                      </td>
                      <td className="py-2 px-4 text-right tabular-nums">{form.total}</td>
                      <td className="py-2 px-4 text-right tabular-nums">{form.thisWeek}</td>
                      <td className="py-2 pl-4 text-right tabular-nums">{form.thisMonth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </>
  )
}
