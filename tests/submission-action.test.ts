import assert from "node:assert/strict"
import test from "node:test"

import { action } from "../app/routes/api.forms.$formId.submissions"

type BindCall = unknown[]

function createSubmissionDbMock() {
  const inserts: BindCall[] = []
  const firstQueries: Array<{ sql: string; values: BindCall }> = []

  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first() {
              if (sql.includes("FROM forms WHERE id = ?")) {
                return {
                  id: "form-1",
                  name: "Contact",
                  allowed_origins: null,
                  notification_email: null,
                  notification_email_password: null,
                  smtp_host: null,
                  smtp_port: null,
                  webhook_url: null,
                  webhook_secret: null,
                  server_token_hash: null,
                }
              }

              firstQueries.push({ sql, values })

              if (sql.includes("SELECT COUNT(*) as cnt")) {
                return { cnt: 0 }
              }

              throw new Error(`Unexpected first() query: ${sql}`)
            },
            async run() {
              if (sql.includes("INSERT INTO submissions")) {
                inserts.push(values)
                return { success: true }
              }

              throw new Error(`Unexpected run() query: ${sql}`)
            },
          }
        },
      }
    },
  }

  return { db, firstQueries, inserts }
}

test("honeypot submissions are accepted without storing spam rows or side effects", async () => {
  const { db, firstQueries, inserts } = createSubmissionDbMock()
  const waitUntilCalls: Promise<unknown>[] = []

  const result = await action({
    request: new Request("https://app.example.com/api/forms/form-1/submissions", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Bot",
        email: "bot@example.com",
        message: "spam payload",
        _gotcha: "filled",
        _redirect: "https://example.com/thanks",
      }),
    }),
    params: { formId: "form-1" },
    context: {
      cloudflare: {
        env: { DB: db },
        ctx: {
          waitUntil(promise: Promise<unknown>) {
            waitUntilCalls.push(promise)
          },
        },
      },
    },
  } as never) as { data: { success: boolean; suppressedSpam: boolean }; init: { status: number } }

  assert.equal(result.init.status, 201)
  assert.equal(result.data.success, true)
  assert.equal(result.data.suppressedSpam, true)
  assert.equal(firstQueries.length, 0)
  assert.equal(inserts.length, 0)
  assert.equal(waitUntilCalls.length, 0)
})

test("low-information random messages are accepted without storing spam rows", async () => {
  const { db, firstQueries, inserts } = createSubmissionDbMock()
  const waitUntilCalls: Promise<unknown>[] = []

  const result = await action({
    request: new Request("https://app.example.com/api/forms/form-1/submissions", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "charvard1@shopcobe.com",
        message: "5l5flz",
      }),
    }),
    params: { formId: "form-1" },
    context: {
      cloudflare: {
        env: { DB: db },
        ctx: {
          waitUntil(promise: Promise<unknown>) {
            waitUntilCalls.push(promise)
          },
        },
      },
    },
  } as never) as { data: { success: boolean; suppressedSpam: boolean }; init: { status: number } }

  assert.equal(result.init.status, 201)
  assert.equal(result.data.success, true)
  assert.equal(result.data.suppressedSpam, true)
  assert.equal(firstQueries.length, 0)
  assert.equal(inserts.length, 0)
  assert.equal(waitUntilCalls.length, 0)
})

test("repeated spam from the same mailbox is accepted without storing another row", async () => {
  const { db, firstQueries, inserts } = createSubmissionDbMock()
  const waitUntilCalls: Promise<unknown>[] = []

  const result = await action({
    request: new Request("https://app.example.com/api/forms/form-1/submissions", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "baguswin@whatthefish.info",
        message: "f0qro6",
        _gotcha: "filled",
      }),
    }),
    params: { formId: "form-1" },
    context: {
      cloudflare: {
        env: { DB: db },
        ctx: {
          waitUntil(promise: Promise<unknown>) {
            waitUntilCalls.push(promise)
          },
        },
      },
    },
  } as never) as { data: { success: boolean; suppressedSpam: boolean }; init: { status: number } }

  assert.equal(result.init.status, 201)
  assert.equal(result.data.success, true)
  assert.equal(result.data.suppressedSpam, true)
  assert.equal(firstQueries.length, 0)
  assert.equal(inserts.length, 0)
  assert.equal(waitUntilCalls.length, 0)
})

test("repeated spam from the same source domain is accepted without storing another row", async () => {
  const { db, firstQueries, inserts } = createSubmissionDbMock()
  const waitUntilCalls: Promise<unknown>[] = []

  const result = await action({
    request: new Request("https://app.example.com/api/forms/form-1/submissions", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: "https://teenfish.com",
      },
      body: JSON.stringify({
        email: "new-spammer@example.com",
        message: "q8j1xn",
        _gotcha: "filled",
      }),
    }),
    params: { formId: "form-1" },
    context: {
      cloudflare: {
        env: { DB: db },
        ctx: {
          waitUntil(promise: Promise<unknown>) {
            waitUntilCalls.push(promise)
          },
        },
      },
    },
  } as never) as { data: { success: boolean; suppressedSpam: boolean }; init: { status: number } }

  assert.equal(result.init.status, 201)
  assert.equal(result.data.success, true)
  assert.equal(result.data.suppressedSpam, true)
  assert.equal(firstQueries.length, 0)
  assert.equal(inserts.length, 0)
  assert.equal(waitUntilCalls.length, 0)
})
