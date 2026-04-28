const EMAIL_KEYS = ["email", "e-mail", "mail"]
const NAME_KEYS = ["name", "full_name", "fullname", "your_name"]
const MESSAGE_KEYS = ["message", "msg", "comments", "comment", "body"]
const CONTROL_FIELDS = new Set(["_gotcha", "_redirect"])

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

  try {
    return new URL(origin).hostname
  } catch {
    return origin
  }
}
