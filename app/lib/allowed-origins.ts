const BASE_SUBMISSION_CORS_HEADERS = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Idempotency-Key",
  "Access-Control-Max-Age": "86400",
} as const

export function normalizeAllowedOrigin(value: string): string | null {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  try {
    const url = new URL(trimmedValue)

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }

    return url.origin
  } catch {
    return null
  }
}

export function parseAllowedOrigins(value: string | null | undefined) {
  const seenOrigins = new Set<string>()
  const origins: string[] = []
  const invalidEntries: string[] = []

  for (const line of (value || "").split(/\r?\n/)) {
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      continue
    }

    const normalizedOrigin = normalizeAllowedOrigin(trimmedLine)

    if (!normalizedOrigin) {
      invalidEntries.push(trimmedLine)
      continue
    }

    if (!seenOrigins.has(normalizedOrigin)) {
      seenOrigins.add(normalizedOrigin)
      origins.push(normalizedOrigin)
    }
  }

  return {
    origins,
    invalidEntries,
  }
}

export function formatAllowedOrigins(origins: string[]) {
  return origins.join("\n")
}

export function isOriginAllowed(
  requestOrigin: string | null,
  allowedOrigins: string[]
) {
  if (allowedOrigins.length === 0) {
    return true
  }

  if (!requestOrigin) {
    return true
  }

  const normalizedRequestOrigin = normalizeAllowedOrigin(requestOrigin)

  if (!normalizedRequestOrigin) {
    return false
  }

  return allowedOrigins.includes(normalizedRequestOrigin)
}

export function buildSubmissionCorsHeaders(
  requestOrigin: string | null,
  allowedOrigins: string[]
) {
  const headers: Record<string, string> = {
    ...BASE_SUBMISSION_CORS_HEADERS,
  }

  if (allowedOrigins.length === 0) {
    headers["Access-Control-Allow-Origin"] = "*"
    return headers
  }

  headers.Vary = "Origin"

  const normalizedRequestOrigin = requestOrigin
    ? normalizeAllowedOrigin(requestOrigin)
    : null

  if (
    normalizedRequestOrigin &&
    allowedOrigins.includes(normalizedRequestOrigin)
  ) {
    headers["Access-Control-Allow-Origin"] = normalizedRequestOrigin
  }

  return headers
}
