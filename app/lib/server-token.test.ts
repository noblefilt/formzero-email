import assert from "node:assert/strict"
import test from "node:test"

import {
  extractBearerToken,
  generateServerToken,
  hashServerToken,
  verifyServerToken,
} from "./server-token"

test("generateServerToken returns a stable prefix and enough entropy", () => {
  const token = generateServerToken()

  assert.match(token, /^fz_srv_[a-f0-9]{48}$/)
})

test("hashServerToken and verifyServerToken work together", async () => {
  const token = "fz_srv_example_token"
  const hash = await hashServerToken(token)

  assert.equal(hash.length, 64)
  assert.equal(await verifyServerToken(token, hash), true)
  assert.equal(await verifyServerToken("fz_srv_wrong", hash), false)
})

test("extractBearerToken supports bearer and fallback headers", () => {
  const bearerHeaders = new Headers({
    authorization: "Bearer fz_srv_test",
  })
  const fallbackHeaders = new Headers({
    "x-formzero-token": "fz_srv_fallback",
  })

  assert.equal(extractBearerToken(bearerHeaders), "fz_srv_test")
  assert.equal(extractBearerToken(fallbackHeaders), "fz_srv_fallback")
  assert.equal(extractBearerToken(new Headers()), null)
})
