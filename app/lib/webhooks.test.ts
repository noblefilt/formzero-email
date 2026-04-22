import assert from "node:assert/strict"
import test from "node:test"

import { buildWebhookPayload, signWebhookPayload } from "./webhooks"

test("buildWebhookPayload keeps submission metadata needed for tracing", () => {
  const payload = buildWebhookPayload({
    deliveryId: "delivery-1",
    attemptNumber: 2,
    replayedFromDeliveryId: "delivery-0",
    timestamp: "2026-04-23T08:00:00.000Z",
    form: {
      id: "contact",
      name: "Contact",
      webhook_url: "https://example.com/webhook",
      webhook_secret: "secret",
    },
    submission: {
      id: "sub-1",
      createdAt: 123,
      idempotencyKey: "idem-1",
      source: "server_token",
      origin: null,
      data: {
        email: "hello@example.com",
      },
    },
  })

  assert.equal(payload.event, "submission.created")
  assert.equal(payload.delivery.attempt, 2)
  assert.equal(payload.delivery.replayedFromDeliveryId, "delivery-0")
  assert.equal(payload.submission.idempotencyKey, "idem-1")
  assert.equal(payload.submission.source, "server_token")
})

test("signWebhookPayload is deterministic for the same input", async () => {
  const signature = await signWebhookPayload(
    "whsec_test",
    "2026-04-23T08:00:00.000Z",
    '{"hello":"world"}'
  )

  assert.equal(
    signature,
    "f6810b575a75165ae1bfc4c3f03cd8dbc86f221fcf388661b89d00178d8fbcda"
  )
})
