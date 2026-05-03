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
const LOW_INFORMATION_MESSAGE_MAX_LENGTH = 32
const SHORT_RANDOM_MESSAGE_MAX_LENGTH = 10

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
    if (honeypotValue.trim().length > 0) return true
  } else if (honeypotValue) {
    return true
  }

  const message = getSubmissionMessage(data)
  if (!message) return false

  const compactMessage = message.replace(/\s+/g, "")
  if (!compactMessage) return false
  if (compactMessage.length <= 1) return true

  if (
    compactMessage.length <= SHORT_RANDOM_MESSAGE_MAX_LENGTH &&
    /^[a-z0-9]+$/i.test(compactMessage) &&
    /\d/.test(compactMessage)
  ) {
    return true
  }

  if (
    compactMessage.length <= LOW_INFORMATION_MESSAGE_MAX_LENGTH &&
    /^[a-z]+$/i.test(compactMessage) &&
    /[bcdfghjklmnpqrstvwxyz]{4,}/i.test(compactMessage)
  ) {
    return true
  }

  return false
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
