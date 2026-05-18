import { parseAllowedOrigins } from "#/lib/allowed-origins"
import {
  getSubmissionFieldLabel,
  getVisibleSubmissionEntries,
} from "#/lib/submission-display"
import {
  getSubmissionEmail,
  getSubmissionMessage,
  getSubmissionName,
  getSubmissionSourceDomain,
} from "#/lib/submission-spam"

const DEFAULT_PAGE_LIMIT = 20
const MAX_PAGE_LIMIT = 100
const SPAM_SCAN_PAGE_SIZE = 500

export type McpVisibleField = {
  key: string
  label: string
  value: string
}

export type McpSubmissionSummary = {
  id: string
  formId: string
  formName: string | null
  createdAt: number
  isRead: boolean
  isArchived: boolean
  isSpam: boolean
  senderName: string | null
  senderEmail: string | null
  message: string | null
  sourceDomain: string
  parseError: boolean
  visibleFields: McpVisibleField[]
}

export type McpFormSummary = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  submissionCount: number
  unreadCount: number
  spamCount: number
  lastSubmissionAt: number | null
}

export type McpFormDetails = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  submissionCount: number
  unreadCount: number
  archivedCount: number
  spamCount: number
  lastSubmissionAt: number | null
  settings: {
    notificationEmail: string | null
    smtpHost: string | null
    smtpPort: number | null
    publicSiteName: string | null
    fromName: string | null
    fromEmail: string | null
    notificationToEmail: string | null
    allowedOrigins: string[]
    webhookUrl: string | null
    hasNotificationPassword: boolean
    hasWebhookSecret: boolean
    hasServerToken: boolean
  }
}

export type McpGlobalSettings = {
  id: string
  notificationEmail: string | null
  smtpHost: string | null
  smtpPort: number | null
  publicSiteName: string | null
  fromName: string | null
  fromEmail: string | null
  notificationToEmail: string | null
  hasNotificationPassword: boolean
  updatedAt: number | null
}

type StoredSubmissionRow = {
  id: string
  form_id: string
  form_name?: string | null
  data: string
  created_at: number
  is_read?: number | null
  is_archived?: number | null
  is_spam?: number | null
  request_origin?: string | null
}

type StoredSettingsRow = {
  id: string
  notification_email: string | null
  notification_email_password: string | null
  smtp_host: string | null
  smtp_port: number | null
  public_site_name: string | null
  from_name: string | null
  from_email: string | null
  notification_to_email: string | null
  updated_at: number | null
}

export function buildMcpHeaders() {
  return {
    "Cache-Control": "no-store",
  }
}

export function getMcpRouteConfig() {
  return {
    defaultLimit: DEFAULT_PAGE_LIMIT,
    maxLimit: MAX_PAGE_LIMIT,
    spamScanPageSize: SPAM_SCAN_PAGE_SIZE,
  }
}

export function validateMcpRequest(request: Request, env: unknown) {
  const configuredToken = getConfiguredMcpToken(env)
  if (!configuredToken) {
    return {
      ok: false as const,
      status: 503,
      error: "MCP access is not configured on this instance.",
    }
  }

  const providedToken = getProvidedMcpToken(request)
  if (!providedToken || providedToken !== configuredToken) {
    return {
      ok: false as const,
      status: 401,
      error: "Invalid MCP token.",
    }
  }

  return { ok: true as const }
}

export function getPaginationParams(url: URL) {
  const limit = clampInteger(
    url.searchParams.get("limit"),
    DEFAULT_PAGE_LIMIT,
    1,
    MAX_PAGE_LIMIT
  )
  const offset = clampInteger(url.searchParams.get("offset"), 0, 0)

  return { limit, offset }
}

export function getSubmissionFilter(url: URL) {
  const filter = url.searchParams.get("filter")?.trim()
  if (filter === "all" || filter === "unread" || filter === "archived") {
    return filter
  }

  return "active"
}

export function getSpamDedupeFlag(url: URL) {
  const raw = url.searchParams.get("dedupe_by_email")
  if (raw === null) return true

  return raw !== "false"
}

export async function listFormsForMcp(
  db: D1Database,
  options: { limit: number; offset: number }
) {
  const totalResult = await db
    .prepare("SELECT COUNT(*) AS count FROM forms")
    .first<{ count: number }>()
  const total = totalResult?.count ?? 0

  const result = await db
    .prepare(
      `SELECT
         f.id,
         f.name,
         f.created_at,
         f.updated_at,
         SUM(CASE WHEN s.id IS NOT NULL AND COALESCE(s.is_spam, 0) = 0 THEN 1 ELSE 0 END) AS submission_count,
         SUM(CASE WHEN s.id IS NOT NULL AND COALESCE(s.is_spam, 0) = 0 AND COALESCE(s.is_read, 0) = 0 AND COALESCE(s.is_archived, 0) = 0 THEN 1 ELSE 0 END) AS unread_count,
         SUM(CASE WHEN s.id IS NOT NULL AND COALESCE(s.is_spam, 0) = 1 THEN 1 ELSE 0 END) AS spam_count,
         MAX(CASE WHEN s.id IS NOT NULL AND COALESCE(s.is_spam, 0) = 0 THEN s.created_at ELSE NULL END) AS last_submission_at
       FROM forms f
       LEFT JOIN submissions s ON s.form_id = f.id
       GROUP BY f.id, f.name, f.created_at, f.updated_at
       ORDER BY unread_count DESC, last_submission_at DESC, f.created_at ASC
       LIMIT ? OFFSET ?`
    )
    .bind(options.limit, options.offset)
    .all<{
      id: string
      name: string
      created_at: number
      updated_at: number
      submission_count: number | null
      unread_count: number | null
      spam_count: number | null
      last_submission_at: number | null
    }>()

  const forms = result.results.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submissionCount: row.submission_count ?? 0,
    unreadCount: row.unread_count ?? 0,
    spamCount: row.spam_count ?? 0,
    lastSubmissionAt: row.last_submission_at ?? null,
  }))

  return buildListResult("forms", forms, total, options)
}

export async function getFormDetailsForMcp(db: D1Database, formId: string) {
  const form = await db
    .prepare(
      `SELECT
         id,
         name,
         created_at,
         updated_at,
         notification_email,
         notification_email_password,
         smtp_host,
         smtp_port,
         public_site_name,
         from_name,
         from_email,
         notification_to_email,
         allowed_origins,
         webhook_url,
         webhook_secret,
         server_token_hash
       FROM forms
       WHERE id = ?
       LIMIT 1`
    )
    .bind(formId)
    .first<{
      id: string
      name: string
      created_at: number
      updated_at: number
      notification_email: string | null
      notification_email_password: string | null
      smtp_host: string | null
      smtp_port: number | null
      public_site_name: string | null
      from_name: string | null
      from_email: string | null
      notification_to_email: string | null
      allowed_origins: string | null
      webhook_url: string | null
      webhook_secret: string | null
      server_token_hash: string | null
    }>()

  if (!form) return null

  const counts = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN COALESCE(is_spam, 0) = 0 THEN 1 ELSE 0 END) AS submission_count,
         SUM(CASE WHEN COALESCE(is_spam, 0) = 0 AND COALESCE(is_read, 0) = 0 AND COALESCE(is_archived, 0) = 0 THEN 1 ELSE 0 END) AS unread_count,
         SUM(CASE WHEN COALESCE(is_spam, 0) = 0 AND COALESCE(is_archived, 0) = 1 THEN 1 ELSE 0 END) AS archived_count,
         SUM(CASE WHEN COALESCE(is_spam, 0) = 1 THEN 1 ELSE 0 END) AS spam_count,
         MAX(CASE WHEN COALESCE(is_spam, 0) = 0 THEN created_at ELSE NULL END) AS last_submission_at
       FROM submissions
       WHERE form_id = ?`
    )
    .bind(formId)
    .first<{
      submission_count: number | null
      unread_count: number | null
      archived_count: number | null
      spam_count: number | null
      last_submission_at: number | null
    }>()

  return {
    form: {
      id: form.id,
      name: form.name,
      createdAt: form.created_at,
      updatedAt: form.updated_at,
      submissionCount: counts?.submission_count ?? 0,
      unreadCount: counts?.unread_count ?? 0,
      archivedCount: counts?.archived_count ?? 0,
      spamCount: counts?.spam_count ?? 0,
      lastSubmissionAt: counts?.last_submission_at ?? null,
      settings: {
        notificationEmail: form.notification_email,
        smtpHost: form.smtp_host,
        smtpPort: form.smtp_port,
        publicSiteName: form.public_site_name,
        fromName: form.from_name,
        fromEmail: form.from_email,
        notificationToEmail: form.notification_to_email,
        allowedOrigins: parseAllowedOrigins(form.allowed_origins).origins,
        webhookUrl: form.webhook_url,
        hasNotificationPassword: Boolean(form.notification_email_password),
        hasWebhookSecret: Boolean(form.webhook_secret),
        hasServerToken: Boolean(form.server_token_hash),
      },
    } satisfies McpFormDetails,
  }
}

export async function listSubmissionsForMcp(
  db: D1Database,
  formId: string,
  options: { filter: string; limit: number; offset: number }
) {
  const form = await db
    .prepare("SELECT id, name FROM forms WHERE id = ? LIMIT 1")
    .bind(formId)
    .first<{ id: string; name: string }>()

  if (!form) return null

  const where = getSubmissionWhereClause(options.filter)
  const countQuery = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM submissions
       WHERE form_id = ? AND COALESCE(is_spam, 0) = 0 ${where.sql}`
    )
    .bind(formId, ...where.values)
    .first<{ count: number }>()
  const total = countQuery?.count ?? 0

  const result = await db
    .prepare(
      `SELECT
         id,
         form_id,
         data,
         created_at,
         is_read,
         is_archived,
         is_spam,
         request_origin
       FROM submissions
       WHERE form_id = ? AND COALESCE(is_spam, 0) = 0 ${where.sql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(formId, ...where.values, options.limit, options.offset)
    .all<StoredSubmissionRow>()

  const submissions = result.results.map((row) =>
    formatSubmissionForMcp({
      ...row,
      form_name: form.name,
    })
  )

  return {
    form: { id: form.id, name: form.name },
    ...buildListResult("submissions", submissions, total, options),
  }
}

export async function getSubmissionForMcp(db: D1Database, submissionId: string) {
  const row = await db
    .prepare(
      `SELECT
         s.id,
         s.form_id,
         f.name AS form_name,
         s.data,
         s.created_at,
         s.is_read,
         s.is_archived,
         s.is_spam,
         s.request_origin
       FROM submissions s
       INNER JOIN forms f ON f.id = s.form_id
       WHERE s.id = ?
       LIMIT 1`
    )
    .bind(submissionId)
    .first<StoredSubmissionRow>()

  if (!row) return null

  return {
    submission: formatSubmissionForMcp(row),
  }
}

export async function listSpamForMcp(
  db: D1Database,
  options: { limit: number; offset: number; dedupeByEmail: boolean }
) {
  const allRows = options.dedupeByEmail
    ? await loadAllSpamRows(db)
    : null

  const dedupedRows = allRows ? dedupeSpamRowsByEmail(allRows) : null
  const total = dedupedRows
    ? dedupedRows.submissions.length
    : await countSpamRows(db)

  const pagedRows = dedupedRows
    ? dedupedRows.submissions.slice(options.offset, options.offset + options.limit)
    : await loadSpamRows(db, {
        limit: options.limit,
        offset: options.offset,
      })

  const spam = pagedRows.map((row) => formatSubmissionForMcp(row))

  return {
    dedupeByEmail: options.dedupeByEmail,
    hiddenDuplicateCount: dedupedRows?.duplicateSubmissionIds.length ?? 0,
    ...buildListResult("spam", spam, total, options),
  }
}

export async function getGlobalSettingsForMcp(db: D1Database) {
  const row = await db
    .prepare(
      `SELECT
         id,
         notification_email,
         notification_email_password,
         smtp_host,
         smtp_port,
         public_site_name,
         from_name,
         from_email,
         notification_to_email,
         updated_at
       FROM settings
       WHERE id = 'global'
       LIMIT 1`
    )
    .first<StoredSettingsRow>()

  if (!row) {
    return {
      settings: null,
    }
  }

  return {
    settings: {
      id: row.id,
      notificationEmail: row.notification_email,
      smtpHost: row.smtp_host,
      smtpPort: row.smtp_port,
      publicSiteName: row.public_site_name,
      fromName: row.from_name,
      fromEmail: row.from_email,
      notificationToEmail: row.notification_to_email,
      hasNotificationPassword: Boolean(row.notification_email_password),
      updatedAt: row.updated_at ?? null,
    } satisfies McpGlobalSettings,
  }
}

function getConfiguredMcpToken(env: unknown) {
  if (!env || typeof env !== "object") return null

  const value = (env as { FORMZERO_MCP_TOKEN?: unknown }).FORMZERO_MCP_TOKEN
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function getProvidedMcpToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim()
  if (authorization?.startsWith("Bearer ")) {
    const value = authorization.slice("Bearer ".length).trim()
    if (value) return value
  }

  const fallback = request.headers.get("x-formzero-mcp-token")?.trim()
  return fallback || null
}

function clampInteger(
  value: string | null,
  fallback: number,
  min: number,
  max = Number.POSITIVE_INFINITY
) {
  const parsed = Number.parseInt(value || "", 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

function getSubmissionWhereClause(filter: string) {
  if (filter === "unread") {
    return {
      sql: "AND COALESCE(is_read, 0) = 0 AND COALESCE(is_archived, 0) = 0",
      values: [] as unknown[],
    }
  }

  if (filter === "archived") {
    return {
      sql: "AND COALESCE(is_archived, 0) = 1",
      values: [] as unknown[],
    }
  }

  if (filter === "active") {
    return {
      sql: "AND COALESCE(is_archived, 0) = 0",
      values: [] as unknown[],
    }
  }

  return {
    sql: "",
    values: [] as unknown[],
  }
}

function parseStoredSubmissionData(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return {
        data: value as Record<string, unknown>,
        parseError: false,
      }
    }
  } catch {
    // The parseError flag below is enough context for operators.
  }

  return {
    data: {},
    parseError: true,
  }
}

function formatSubmissionForMcp(row: StoredSubmissionRow) {
  const parsed = parseStoredSubmissionData(row.data)
  const visibleFields = getVisibleSubmissionEntries(parsed.data).map(
    ([key, value]) => ({
      key,
      label: getSubmissionFieldLabel(key),
      value: stringifyFieldValue(value),
    })
  )

  return {
    id: row.id,
    formId: row.form_id,
    formName: row.form_name ?? null,
    createdAt: row.created_at,
    isRead: Boolean(row.is_read),
    isArchived: Boolean(row.is_archived),
    isSpam: Boolean(row.is_spam),
    senderName: getSubmissionName(parsed.data),
    senderEmail: getSubmissionEmail(parsed.data),
    message: getSubmissionMessage(parsed.data),
    sourceDomain: getSubmissionSourceDomain(
      parsed.data,
      row.request_origin ?? null
    ),
    parseError: parsed.parseError,
    visibleFields,
  } satisfies McpSubmissionSummary
}

function stringifyFieldValue(value: unknown) {
  if (typeof value === "string") return value
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value)
  }
  if (value === null) return "null"
  if (typeof value === "undefined") return ""

  try {
    return JSON.stringify(value)
  } catch {
    return "[unavailable]"
  }
}

async function countSpamRows(db: D1Database) {
  const result = await db
    .prepare("SELECT COUNT(*) AS count FROM submissions WHERE COALESCE(is_spam, 0) = 1")
    .first<{ count: number }>()

  return result?.count ?? 0
}

async function loadSpamRows(
  db: D1Database,
  options: { limit?: number; offset?: number } = {}
) {
  const limit = options.limit ?? SPAM_SCAN_PAGE_SIZE
  const offset = options.offset ?? 0

  const result = await db
    .prepare(
      `SELECT
         s.id,
         s.form_id,
         f.name AS form_name,
         s.data,
         s.created_at,
         s.request_origin,
         s.is_spam
       FROM submissions s
       INNER JOIN forms f ON f.id = s.form_id
       WHERE COALESCE(s.is_spam, 0) = 1
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all<StoredSubmissionRow>()

  return result.results
}

async function loadAllSpamRows(db: D1Database) {
  const rows: StoredSubmissionRow[] = []

  for (let offset = 0; ; offset += SPAM_SCAN_PAGE_SIZE) {
    const page = await loadSpamRows(db, {
      limit: SPAM_SCAN_PAGE_SIZE,
      offset,
    })
    rows.push(...page)

    if (page.length < SPAM_SCAN_PAGE_SIZE) break
  }

  return rows
}

function dedupeSpamRowsByEmail(rows: StoredSubmissionRow[]) {
  const seenEmails = new Set<string>()
  const duplicateSubmissionIds: string[] = []
  const submissions: StoredSubmissionRow[] = []

  for (const row of rows) {
    const parsed = parseStoredSubmissionData(row.data)
    const senderEmail = getSubmissionEmail(parsed.data)?.trim().toLowerCase()
    if (!senderEmail) {
      submissions.push(row)
      continue
    }

    if (seenEmails.has(senderEmail)) {
      duplicateSubmissionIds.push(row.id)
      continue
    }

    seenEmails.add(senderEmail)
    submissions.push(row)
  }

  return { submissions, duplicateSubmissionIds }
}

function buildListResult<T>(
  key: string,
  items: T[],
  total: number,
  options: { limit: number; offset: number }
) {
  const hasMore = options.offset + items.length < total

  return {
    [key]: items,
    total,
    count: items.length,
    limit: options.limit,
    offset: options.offset,
    hasMore,
    nextOffset: hasMore ? options.offset + items.length : null,
  }
}
