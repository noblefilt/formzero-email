const SERVER_TOKEN_PREFIX = "fz_srv_"
const TEXT_ENCODER = new TextEncoder()

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    TEXT_ENCODER.encode(value)
  )

  return bytesToHex(new Uint8Array(digest))
}

function randomHex(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  return bytesToHex(bytes)
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false
  }

  let result = 0

  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return result === 0
}

export function generateServerToken() {
  return `${SERVER_TOKEN_PREFIX}${randomHex(24)}`
}

export async function hashServerToken(token: string) {
  return sha256(token.trim())
}

export async function verifyServerToken(
  token: string,
  expectedHash: string | null | undefined
) {
  if (!expectedHash) {
    return false
  }

  const actualHash = await hashServerToken(token)
  return constantTimeEqual(actualHash, expectedHash)
}

export function extractBearerToken(headers: Headers) {
  const authorizationHeader = headers.get("authorization")

  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length).trim() || null
  }

  const fallbackToken = headers.get("x-formzero-token")?.trim()
  return fallbackToken || null
}
