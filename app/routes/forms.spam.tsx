import type { Route } from "./+types/forms.spam"
import * as React from "react"
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

export type SpamSubmissionRow = {
  id: string
  data: string
  created_at: number
  request_origin: string | null
}

export type SpamSubmission = {
  id: string
  createdAt: number
  email: string
  message: string
  sourceDomain: string
}

const DELETE_SPAM_CHUNK_SIZE = 50
const SPAM_PAGE_SIZE = 500

function getSpamEmailKey(email: string) {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || trimmed === "无邮箱") return null
  return trimmed
}

function dedupeSpamSubmissionsByEmail(submissions: SpamSubmission[]) {
  const seenEmails = new Set<string>()
  const duplicateSubmissionIds: string[] = []
  const dedupedSubmissions: SpamSubmission[] = []

  for (const submission of submissions) {
    const emailKey = getSpamEmailKey(submission.email)
    if (!emailKey) {
      dedupedSubmissions.push(submission)
      continue
    }

    if (seenEmails.has(emailKey)) {
      duplicateSubmissionIds.push(submission.id)
      continue
    }

    seenEmails.add(emailKey)
    dedupedSubmissions.push(submission)
  }

  return { submissions: dedupedSubmissions, duplicateSubmissionIds }
}

export function parseSpamSubmissionRow(row: SpamSubmissionRow): SpamSubmission {
  let parsedData: Record<string, unknown> = {}
  let parseFailed = false

  try {
    const value = JSON.parse(row.data) as unknown
    if (value && typeof value === "object" && !Array.isArray(value)) {
      parsedData = value as Record<string, unknown>
    } else {
      parseFailed = true
    }
  } catch {
    parseFailed = true
  }

  return {
    id: row.id,
    createdAt: row.created_at,
    email: getSubmissionEmail(parsedData) || "无邮箱",
    message:
      getSubmissionMessage(parsedData) ||
      (parseFailed ? "无法解析提交内容" : "无消息"),
    sourceDomain: getSubmissionSourceDomain(parsedData, row.request_origin),
  }
}

async function loadSpamSubmissions(
  database: D1Database,
  options: { limit?: number; offset?: number } = {}
) {
  const limit = options.limit ?? SPAM_PAGE_SIZE
  const offset = options.offset ?? 0
  const result = await database
    .prepare(
      `SELECT id, data, created_at, request_origin
       FROM submissions
       WHERE COALESCE(is_spam, 0) = 1
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all<SpamSubmissionRow>()

  return result.results.map(parseSpamSubmissionRow)
}

async function loadAllSpamSubmissions(database: D1Database) {
  const submissions: SpamSubmission[] = []

  for (let offset = 0; ; offset += SPAM_PAGE_SIZE) {
    const page = await loadSpamSubmissions(database, {
      limit: SPAM_PAGE_SIZE,
      offset,
    })
    submissions.push(...page)

    if (page.length < SPAM_PAGE_SIZE) break
  }

  return submissions
}

export async function deleteSpamRowsByIds(database: D1Database, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean)
  let deleted = 0

  for (let index = 0; index < uniqueIds.length; index += DELETE_SPAM_CHUNK_SIZE) {
    const chunk = uniqueIds.slice(index, index + DELETE_SPAM_CHUNK_SIZE)
    const placeholders = chunk.map(() => "?").join(", ")
    await database
      .prepare(
        `DELETE FROM submissions WHERE id IN (${placeholders}) AND COALESCE(is_spam, 0) = 1`
      )
      .bind(...chunk)
      .run()
    deleted += chunk.length
  }

  return deleted
}

export async function deleteDuplicateSpamRows(database: D1Database) {
  const { duplicateSubmissionIds } = dedupeSpamSubmissionsByEmail(
    await loadAllSpamSubmissions(database)
  )

  if (duplicateSubmissionIds.length === 0) return 0

  return deleteSpamRowsByIds(database, duplicateSubmissionIds)
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

    try {
      await database
        .prepare("UPDATE submissions SET is_spam = 0 WHERE id = ?")
        .bind(id)
        .run()
    } catch (error) {
      console.error("Failed to restore spam submission:", error)
      return data({ error: "还原失败，请刷新后重试。" }, { status: 500 })
    }

    return data({ success: true })
  }

  if (intent === "delete_spam") {
    const id = formData.get("id")
    if (typeof id !== "string" || !id) {
      return data({ error: "缺少提交 ID" }, { status: 400 })
    }

    try {
      await database
        .prepare("DELETE FROM submissions WHERE id = ? AND COALESCE(is_spam, 0) = 1")
        .bind(id)
        .run()
    } catch (error) {
      console.error("Failed to delete spam submission:", error)
      return data({ error: "删除失败，请刷新后重试。" }, { status: 500 })
    }

    return data({ success: true })
  }

  if (intent === "delete_spam_bulk") {
    const ids = formData
      .getAll("ids")
      .filter((id): id is string => typeof id === "string" && id.length > 0)

    if (ids.length === 0) {
      return data({ error: "未选择垃圾邮件" }, { status: 400 })
    }

    try {
      const deleted = await deleteSpamRowsByIds(database, ids)

      return data({ success: true, deleted })
    } catch (error) {
      console.error("Failed to bulk delete spam submissions:", error)
      return data({ error: "批量删除失败，请刷新后重试。" }, { status: 500 })
    }
  }

  if (intent === "delete_duplicate_spam") {
    try {
      const deleted = await deleteDuplicateSpamRows(database)

      return data({ success: true, deleted })
    } catch (error) {
      console.error("Failed to delete duplicate spam submissions:", error)
      return data({ error: "清理重复垃圾邮件失败，请刷新后重试。" }, { status: 500 })
    }
  }

  return data({ error: "未知操作" }, { status: 400 })
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const database = context.cloudflare.env.DB
  await requireAuth(request, database, context.cloudflare.env)

  return dedupeSpamSubmissionsByEmail(await loadSpamSubmissions(database))
}

export default function SpamPage({ loaderData }: Route.ComponentProps) {
  const { submissions, duplicateSubmissionIds } = loaderData
  const restoreFetcher = useFetcher()
  const deleteFetcher = useFetcher()
  const bulkDeleteFetcher = useFetcher()
  const duplicateDeleteFetcher = useFetcher()
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const restoringId = restoreFetcher.formData?.get("id")?.toString()
  const deletingId = deleteFetcher.formData?.get("id")?.toString()
  const actionError =
    restoreFetcher.data?.error ||
    deleteFetcher.data?.error ||
    bulkDeleteFetcher.data?.error ||
    duplicateDeleteFetcher.data?.error
  const allSelected =
    submissions.length > 0 &&
    submissions.every((submission) => selectedIds.includes(submission.id))
  const someSelected = selectedIds.length > 0 && !allSelected

  const toggleAllSelected = () => {
    setSelectedIds(allSelected ? [] : submissions.map((submission) => submission.id))
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    )
  }

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

        {actionError && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {actionError}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {selectedIds.length > 0
              ? `已选择 ${selectedIds.length} 条`
              : `共 ${submissions.length} 条垃圾邮件`}
            {duplicateSubmissionIds.length > 0
              ? `，已隐藏 ${duplicateSubmissionIds.length} 条重复邮箱记录`
              : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {duplicateSubmissionIds.length > 0 && (
              <duplicateDeleteFetcher.Form
                method="post"
                onSubmit={(event) => {
                  if (!confirm(`确定删除 ${duplicateSubmissionIds.length} 条重复邮箱垃圾邮件吗？每个邮箱会保留最新一条。`)) {
                    event.preventDefault()
                  }
                }}
              >
                <input type="hidden" name="intent" value="delete_duplicate_spam" />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={duplicateDeleteFetcher.state !== "idle"}
                  className="h-9 gap-1.5 text-xs"
                >
                  <Trash2 className="h-3 w-3" />
                  {duplicateDeleteFetcher.state !== "idle" ? "清理中..." : "清理重复邮箱"}
                </Button>
              </duplicateDeleteFetcher.Form>
            )}
            {selectedIds.length > 0 && (
              <bulkDeleteFetcher.Form
                method="post"
                onSubmit={(event) => {
                  if (!confirm(`确定永久删除这 ${selectedIds.length} 条垃圾邮件吗？`)) {
                    event.preventDefault()
                  }
                }}
              >
                <input type="hidden" name="intent" value="delete_spam_bulk" />
                {selectedIds.map((id) => (
                  <input key={id} type="hidden" name="ids" value={id} />
                ))}
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={bulkDeleteFetcher.state !== "idle"}
                  className="h-9 gap-1.5 text-xs"
                >
                  <Trash2 className="h-3 w-3" />
                  {bulkDeleteFetcher.state !== "idle" ? "删除中..." : `批量删除 ${selectedIds.length}`}
                </Button>
              </bulkDeleteFetcher.Form>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 px-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(element) => {
                      if (element) element.indeterminate = someSelected
                    }}
                    onChange={toggleAllSelected}
                    className="h-4 w-4 rounded border-gray-300"
                    aria-label="全选垃圾邮件"
                  />
                </TableHead>
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
                const isSelected = selectedIds.includes(submission.id)

                return (
                  <TableRow
                    key={submission.id}
                    data-state={isSelected ? "selected" : undefined}
                    className={isSelected ? "bg-muted/50" : undefined}
                  >
                    <TableCell className="w-10 px-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(submission.id)}
                        className="h-4 w-4 rounded border-gray-300"
                        aria-label={`选择 ${submission.email}`}
                      />
                    </TableCell>
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
