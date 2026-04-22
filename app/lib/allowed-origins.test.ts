import assert from "node:assert/strict"
import test from "node:test"

import {
  buildSubmissionCorsHeaders,
  formatAllowedOrigins,
  isOriginAllowed,
  normalizeAllowedOrigin,
  parseAllowedOrigins,
} from "./allowed-origins"

test("normalizeAllowedOrigin keeps only valid http(s) origins", () => {
  assert.equal(
    normalizeAllowedOrigin("https://example.com/contact?x=1"),
    "https://example.com"
  )
  assert.equal(
    normalizeAllowedOrigin("http://localhost:3000/forms"),
    "http://localhost:3000"
  )
  assert.equal(normalizeAllowedOrigin("ftp://example.com"), null)
  assert.equal(normalizeAllowedOrigin("example.com"), null)
})

test("parseAllowedOrigins trims, deduplicates, and reports invalid entries", () => {
  const parsed = parseAllowedOrigins(`
    https://example.com
    https://example.com/contact
    http://localhost:5173
    invalid-origin
  `)

  assert.deepEqual(parsed.origins, [
    "https://example.com",
    "http://localhost:5173",
  ])
  assert.deepEqual(parsed.invalidEntries, ["invalid-origin"])
  assert.equal(
    formatAllowedOrigins(parsed.origins),
    "https://example.com\nhttp://localhost:5173"
  )
})

test("isOriginAllowed supports unrestricted, browser, and server-side requests", () => {
  const allowedOrigins = ["https://example.com", "https://app.example.com"]

  assert.equal(isOriginAllowed("https://example.com", allowedOrigins), true)
  assert.equal(
    isOriginAllowed("https://app.example.com/dashboard", allowedOrigins),
    true
  )
  assert.equal(isOriginAllowed("https://evil.example.com", allowedOrigins), false)
  assert.equal(isOriginAllowed(null, allowedOrigins), true)
  assert.equal(isOriginAllowed("https://anything.example.com", []), true)
})

test("buildSubmissionCorsHeaders reflects unrestricted and restricted origins", () => {
  assert.deepEqual(buildSubmissionCorsHeaders("https://example.com", []), {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Idempotency-Key",
    "Access-Control-Max-Age": "86400",
  })

  assert.deepEqual(
    buildSubmissionCorsHeaders("https://example.com/page", ["https://example.com"]),
    {
      "Access-Control-Allow-Origin": "https://example.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Idempotency-Key",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    }
  )

  assert.deepEqual(
    buildSubmissionCorsHeaders("https://evil.example.com", ["https://example.com"]),
    {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Idempotency-Key",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    }
  )
})
