import type { Route } from "./+types/forms.spam"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { ShieldAlert } from "lucide-react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/components/ui/empty"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "#/components/ui/breadcrumb"
import { Separator } from "#/components/ui/separator"
import { SidebarTrigger } from "#/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table"
import {
  getSourceDomain,
  getSubmissionEmail,
  getSubmissionMessage,
} from "#/lib/submission-spam"
import { requireAuth } from "~/lib/require-auth.server"

type SpamSubmissionRow = {
  id: string
  data: string
  created_at: number
  request_origin: string | null
}

type SpamSubmission = {
  id: string
  createdAt: number
  email: string
  message: string
  sourceDomain: string
}

export const meta: Route.MetaFunction = () => [
  { title: "垃圾邮件 | FormZero" },
  { name: "description", content: "查看自动标记为垃圾邮件的提交数据" },
]

function formatExactTime(timestamp: number) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
  })
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const database = context.cloudflare.env.DB
  await requireAuth(request, database, context.cloudflare.env)

  const result = await database
    .prepare(
      `SELECT id, data, created_at, request_origin
       FROM submissions
       WHERE COALESCE(is_spam, 0) = 1
       ORDER BY created_at DESC
       LIMIT 500`
    )
    .all<SpamSubmissionRow>()

  const submissions: SpamSubmission[] = result.results.map((row) => {
    const parsedData = JSON.parse(row.data) as Record<string, unknown>

    return {
      id: row.id,
      createdAt: row.created_at,
      email: getSubmissionEmail(parsedData) || "无邮箱",
      message: getSubmissionMessage(parsedData) || "无消息",
      sourceDomain: getSourceDomain(row.request_origin),
    }
  })

  return { submissions }
}

export default function SpamPage({ loaderData }: Route.ComponentProps) {
  const { submissions } = loaderData

  if (submissions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldAlert className="h-10 w-10" />
            </EmptyMedia>
            <EmptyTitle>暂无垃圾邮件</EmptyTitle>
            <EmptyDescription>
              诱捕字段命中的提交会自动进入这里，不会触发邮件通知。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex flex-1 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>垃圾邮件</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="space-y-4 p-4 pt-0">
        <div>
          <h2 className="text-lg font-semibold">垃圾邮件</h2>
          <p className="text-sm text-muted-foreground">
            自动标记的垃圾邮件提交，只显示时间、邮箱、消息和来源域名。
          </p>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>消息</TableHead>
                <TableHead>来源</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => {
                const createdAt = new Date(submission.createdAt)
                return (
                  <TableRow key={submission.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      <span title={formatExactTime(submission.createdAt)}>
                        {formatDistanceToNow(createdAt, {
                          addSuffix: true,
                          locale: zhCN,
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {submission.email}
                    </TableCell>
                    <TableCell className="max-w-xl text-sm">
                      <span className="block max-h-12 overflow-hidden">
                        {submission.message}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {submission.sourceDomain}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  )
}
