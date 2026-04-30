const EMAIL_KEYS = ["email", "e-mail", "mail"]
const NAME_KEYS = ["name", "full_name", "fullname", "your_name"]
const MESSAGE_KEYS = ["message", "msg", "comments", "comment", "body"]
const CONTROL_FIELDS = new Set(["_gotcha", "_redirect"])
const SOURCE_URL_KEYS = new Set([
  "page_url",
  "pageurl",
  "url",
  "referrer",
  "referer",
  "source_url",
])
export const SPAM_BURST_WINDOW_MS = 60 * 60 * 1000
export const SPAM_BURST_EMAIL_LIMIT = 5
export const SPAM_BURST_SOURCE_DOMAIN_LIMIT = 20

function normalizeKey(key: string) {
  return key.trim().toLowerCase().replace(/\s+/g, "_")
}

function getStringField(
  data: Record<string, unknown>,
  candidateKeys: string[]
) {
  for (const [key, value] of Object.entries(data)) {
    if (!candidateKeys.includes(normalizeKey(key))) continue
    if (typeof value !== "string") continue

    const trimmed = value.trim()
    if (trimmed) return trimmed
  }

  return null
}

function getDomainFromUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const hasProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
  const candidate = hasProtocol ? trimmed : `https://${trimmed}`

  try {
    const hostname = new URL(candidate).hostname
    if (!hostname) return null
    if (hostname === "localhost" || hostname.includes(".")) return hostname
  } catch {
    return null
  }

  return null
}

export function isSpamSubmission(data: Record<string, unknown>) {
  const honeypotValue = data._gotcha

  if (typeof honeypotValue === "string") {
    return honeypotValue.trim().length > 0
  }

  return Boolean(honeypotValue)
}

export function cleanSubmissionData(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !CONTROL_FIELDS.has(key))
  )
}

export function getSubmissionEmail(data: Record<string, unknown>) {
  return getStringField(data, EMAIL_KEYS)
}

export function getSubmissionName(data: Record<string, unknown>) {
  return getStringField(data, NAME_KEYS)
}

export function getSubmissionMessage(data: Record<string, unknown>) {
  return getStringField(data, MESSAGE_KEYS)
}

export function getSourceDomain(origin: string | null) {
  if (!origin) return "直接提交"

  return getDomainFromUrl(origin) ?? origin
}

export function getSubmissionSourceDomain(
  data: Record<string, unknown>,
  requestOrigin: string | null
) {
  const originDomain = requestOrigin ? getDomainFromUrl(requestOrigin) : null
  if (originDomain) return originDomain

  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = normalizeKey(key).replace(/-/g, "_")
    if (!SOURCE_URL_KEYS.has(normalizedKey)) continue
    if (typeof value !== "string") continue

    const dataDomain = getDomainFromUrl(value)
    if (dataDomain) return dataDomain
  }

  return getSourceDomain(requestOrigin)
}

export function shouldSuppressSpamBurst({
  emailCount,
  sourceDomainCount,
}: {
  emailCount: number
  sourceDomainCount: number
}) {
  return (
    emailCount >= SPAM_BURST_EMAIL_LIMIT ||
    sourceDomainCount >= SPAM_BURST_SOURCE_DOMAIN_LIMIT
  )
}
