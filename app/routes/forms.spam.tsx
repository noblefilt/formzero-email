import type { Route } from "./+types/forms.spam"
import { data, useFetcher } from "react-router"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { RotateCcw, ShieldAlert, Trash2 } from "lucide-react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/components/ui/empty"
import { Button } from "#/components/ui/button"
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
  getSubmissionEmail,
  getSubmissionMessage,
  getSubmissionSourceDomain,
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

export async function action({ request, context }: Route.ActionArgs) {
  const database = context.cloudflare.env.DB
  await requireAuth(request, database, context.cloudflare.env)

  const formData = await request.formData()
  const intent = formData.get("intent")

  if (intent === "restore_spam") {
    const id = formData.get("id")
    if (typeof id !== "string" || !id) {
      return data({ error: "缺少提交 ID" }, { status: 400 })
    }

    await database
      .prepare("UPDATE submissions SET is_spam = 0 WHERE id = ?")
      .bind(id)
      .run()

    return data({ success: true })
  }

  if (intent === "delete_spam") {
    const id = formData.get("id")
    if (typeof id !== "string" || !id) {
      return data({ error: "缺少提交 ID" }, { status: 400 })
    }

    await database
      .prepare("DELETE FROM submissions WHERE id = ? AND COALESCE(is_spam, 0) = 1")
      .bind(id)
      .run()

    return data({ success: true })
  }

  return data({ error: "未知操作" }, { status: 400 })
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
      sourceDomain: getSubmissionSourceDomain(parsedData, row.request_origin),
    }
  })

  return { submissions }
}

export default function SpamPage({ loaderData }: Route.ComponentProps) {
  const { submissions } = loaderData
  const restoreFetcher = useFetcher()
  const deleteFetcher = useFetcher()
  const restoringId = restoreFetcher.formData?.get("id")?.toString()
  const deletingId = deleteFetcher.formData?.get("id")?.toString()

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
              自动识别的垃圾提交会被静默丢弃；手动标记的垃圾邮件会显示在这里。
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
            手动标记或历史保留的垃圾邮件，只显示时间、邮箱、消息和来源域名。
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
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => {
                const createdAt = new Date(submission.createdAt)
                const isRestoring =
                  restoreFetcher.state !== "idle" && restoringId === submission.id
                const isDeleting =
                  deleteFetcher.state !== "idle" && deletingId === submission.id

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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <restoreFetcher.Form method="post">
                          <input type="hidden" name="intent" value="restore_spam" />
                          <input type="hidden" name="id" value={submission.id} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            disabled={isRestoring || isDeleting}
                            className="h-8 gap-1.5"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {isRestoring ? "还原中..." : "还原"}
                          </Button>
                        </restoreFetcher.Form>
                        <deleteFetcher.Form
                          method="post"
                          onSubmit={(event) => {
                            if (!confirm("确定永久删除这条垃圾邮件吗？")) {
                              event.preventDefault()
                            }
                          }}
                        >
                          <input type="hidden" name="intent" value="delete_spam" />
                          <input type="hidden" name="id" value={submission.id} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            disabled={isRestoring || isDeleting}
                            className="h-8 gap-1.5 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {isDeleting ? "删除中..." : "删除"}
                          </Button>
                        </deleteFetcher.Form>
                      </div>
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
