import assert from "node:assert/strict"
import test from "node:test"

import { loader } from "../app/routes/api.mcp.$"

test("mcp api rejects requests without a valid token", async () => {
  let touchedDatabase = false
  const db = {
    prepare() {
      touchedDatabase = true
      throw new Error("DB should not be touched for unauthorized requests")
    },
  }

  const result = await loader({
    request: new Request("https://app.example.com/api/mcp/forms"),
    params: { "*": "forms" },
    context: {
      cloudflare: {
        env: {
          DB: db,
          FORMZERO_MCP_TOKEN: "mcp-secret",
        },
      },
    },
  } as never) as {
    data: { success: boolean; error: string }
    init: { status: number }
  }

  assert.equal(result.init.status, 401)
  assert.equal(result.data.success, false)
  assert.match(result.data.error, /Invalid MCP token/)
  assert.equal(touchedDatabase, false)
})

test("mcp api lists submissions with hidden metadata removed", async () => {
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first() {
              if (sql.includes("SELECT id, name FROM forms")) {
                assert.deepEqual(values, ["site-a"])
                return { id: "site-a", name: "Site A" }
              }

              if (sql.includes("SELECT COUNT(*) AS count")) {
                return { count: 1 }
              }

              throw new Error(`Unexpected first() query: ${sql}`)
            },
            async all() {
              if (sql.includes("FROM submissions")) {
                return {
                  results: [
                    {
                      id: "sub-1",
                      form_id: "site-a",
                      data: JSON.stringify({
                        name: "Ada Lovelace",
                        email: "ada@example.com",
                        message: "Need a clearer pricing explanation.",
                        page_url: "https://example.com/pricing",
                        utm_source: "google",
                      }),
                      created_at: 1_715_000_000_000,
                      is_read: 0,
                      is_archived: 0,
                      is_spam: 0,
                      request_origin: "https://example.com",
                    },
                  ],
                }
              }

              throw new Error(`Unexpected all() query: ${sql}`)
            },
          }
        },
      }
    },
  }

  const result = await loader({
    request: new Request(
      "https://app.example.com/api/mcp/forms/site-a/submissions?filter=active&limit=10&offset=0",
      {
        headers: {
          Authorization: "Bearer mcp-secret",
        },
      }
    ),
    params: { "*": "forms/site-a/submissions" },
    context: {
      cloudflare: {
        env: {
          DB: db,
          FORMZERO_MCP_TOKEN: "mcp-secret",
        },
      },
    },
  } as never) as {
    data: {
      form: { id: string; name: string }
      submissions: Array<{
        id: string
        senderName: string | null
        senderEmail: string | null
        message: string | null
        sourceDomain: string
        visibleFields: Array<{ key: string; value: string }>
      }>
      total: number
      count: number
    }
    init: { status?: number }
  }

  assert.equal(result.init.status, undefined)
  assert.deepEqual(result.data.form, { id: "site-a", name: "Site A" })
  assert.equal(result.data.total, 1)
  assert.equal(result.data.count, 1)
  assert.equal(result.data.submissions[0].id, "sub-1")
  assert.equal(result.data.submissions[0].senderName, "Ada Lovelace")
  assert.equal(result.data.submissions[0].senderEmail, "ada@example.com")
  assert.equal(
    result.data.submissions[0].message,
    "Need a clearer pricing explanation."
  )
  assert.equal(result.data.submissions[0].sourceDomain, "example.com")
  assert.deepEqual(
    result.data.submissions[0].visibleFields.map((field) => ({
      key: field.key,
      label: field.label,
      value: field.value,
    })),
    [
      { key: "name", label: "姓名", value: "Ada Lovelace" },
      { key: "email", label: "邮箱", value: "ada@example.com" },
      {
        key: "message",
        label: "消息",
        value: "Need a clearer pricing explanation.",
      },
    ]
  )
})

test("mcp api returns safe global settings summaries", async () => {
  const db = {
    prepare(sql: string) {
      return {
        async first() {
          if (sql.includes("FROM settings")) {
            return {
              id: "global",
              notification_email: "smtp@example.com",
              notification_email_password: "super-secret",
              smtp_host: "smtp.example.com",
              smtp_port: 587,
              public_site_name: "Example Site",
              from_name: "Example Site",
              from_email: "hello@example.com",
              notification_to_email: "owner@example.com",
              updated_at: 1_715_000_000_000,
            }
          }

          throw new Error(`Unexpected first() query: ${sql}`)
        },
      }
    },
  }

  const result = await loader({
    request: new Request("https://app.example.com/api/mcp/settings", {
      headers: {
        Authorization: "Bearer mcp-secret",
      },
    }),
    params: { "*": "settings" },
    context: {
      cloudflare: {
        env: {
          DB: db,
          FORMZERO_MCP_TOKEN: "mcp-secret",
        },
      },
    },
  } as never) as {
    data: {
      settings: Record<string, unknown> | null
    }
  }

  assert.equal(result.data.settings?.notificationEmail, "smtp@example.com")
  assert.equal(result.data.settings?.hasNotificationPassword, true)
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result.data.settings,
      "notification_email_password"
    ),
    false
  )
})
