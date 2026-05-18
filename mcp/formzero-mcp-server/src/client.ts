export type ResponseFormat = "markdown" | "json"

export type ListResult<T> = {
  total: number
  count: number
  limit: number
  offset: number
  hasMore: boolean
  nextOffset: number | null
}

export type FormSummary = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  submissionCount: number
  unreadCount: number
  spamCount: number
  lastSubmissionAt: number | null
}

export type VisibleField = {
  key: string
  label: string
  value: string
}

export type SubmissionSummary = {
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
  visibleFields: VisibleField[]
}

export type FormDetails = {
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

export type GlobalSettings = {
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

export type ListFormsResponse = ListResult<FormSummary> & {
  forms: FormSummary[]
}

export type GetFormResponse = {
  form: FormDetails
}

export type ListSubmissionsResponse = ListResult<SubmissionSummary> & {
  form: { id: string; name: string }
  submissions: SubmissionSummary[]
}

export type GetSubmissionResponse = {
  submission: SubmissionSummary
}

export type ListSpamResponse = ListResult<SubmissionSummary> & {
  dedupeByEmail: boolean
  hiddenDuplicateCount: number
  spam: SubmissionSummary[]
}

export type GetSettingsResponse = {
  settings: GlobalSettings | null
}

type ClientConfig = {
  baseUrl: string
  token: string
}

export class FormZeroMcpApiClient {
  constructor(private readonly config: ClientConfig) {}

  async listForms(options: { limit: number; offset: number }) {
    return this.request<ListFormsResponse>("forms", options)
  }

  async getForm(formId: string) {
    return this.request<GetFormResponse>(`forms/${encodeURIComponent(formId)}`)
  }

  async listSubmissions(options: {
    formId: string
    filter: "active" | "unread" | "archived" | "all"
    limit: number
    offset: number
  }) {
    return this.request<ListSubmissionsResponse>(
      `forms/${encodeURIComponent(options.formId)}/submissions`,
      {
        filter: options.filter,
        limit: options.limit,
        offset: options.offset,
      }
    )
  }

  async getSubmission(submissionId: string) {
    return this.request<GetSubmissionResponse>(
      `submissions/${encodeURIComponent(submissionId)}`
    )
  }

  async listSpam(options: {
    dedupeByEmail: boolean
    limit: number
    offset: number
  }) {
    return this.request<ListSpamResponse>("spam", {
      dedupe_by_email: options.dedupeByEmail,
      limit: options.limit,
      offset: options.offset,
    })
  }

  async getSettings() {
    return this.request<GetSettingsResponse>("settings")
  }

  private async request<T>(
    path: string,
    query: Record<string, string | number | boolean | null | undefined> = {}
  ): Promise<T> {
    const url = new URL(`/api/mcp/${path}`, this.config.baseUrl)
    for (const [key, value] of Object.entries(query)) {
      if (value === null || typeof value === "undefined") continue
      url.searchParams.set(key, String(value))
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: "application/json",
        "User-Agent": "formzero-mcp-server/1.0",
      },
      signal: AbortSignal.timeout(15_000),
    })

    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    if (!response.ok) {
      const message =
        payload && typeof payload.error === "string"
          ? payload.error
          : `Request failed with status ${response.status}`
      throw new Error(message)
    }

    return payload as T
  }
}

export function getClientConfig() {
  const baseUrl = process.env.FORMZERO_BASE_URL?.trim()
  const token = process.env.FORMZERO_MCP_TOKEN?.trim()

  if (!baseUrl) {
    throw new Error("Missing FORMZERO_BASE_URL for the FormZero MCP server.")
  }

  if (!token) {
    throw new Error("Missing FORMZERO_MCP_TOKEN for the FormZero MCP server.")
  }

  return {
    baseUrl: baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
    token,
  }
}
