import assert from "node:assert/strict"
import test from "node:test"

import {
  deleteDuplicateSpamRows,
  deleteSpamRowsByIds,
  parseSpamSubmissionRow,
} from "../app/routes/forms.spam"

test("spam bulk deletion chunks large duplicate cleanup batches", async () => {
  const deleteBatches: unknown[][] = []
  const db = {
    prepare(sql: string) {
      assert.match(sql, /DELETE FROM submissions WHERE id IN/)
      return {
        bind(...values: unknown[]) {
          return {
            async run() {
              deleteBatches.push(values)
              return { success: true }
            },
          }
        },
      }
    },
  }

  const ids = Array.from({ length: 121 }, (_, index) => `spam-${index}`)
  const deleted = await deleteSpamRowsByIds(db as never, ids)

  assert.equal(deleted, 121)
  assert.deepEqual(
    deleteBatches.map((batch) => batch.length),
    [50, 50, 21]
  )
})

test("spam row parsing keeps malformed historical rows visible and deletable", () => {
  const submission = parseSpamSubmissionRow({
    id: "broken-spam",
    data: "{not-json",
    created_at: 1710000000000,
    request_origin: "https://source.example",
  })

  assert.deepEqual(submission, {
    id: "broken-spam",
    createdAt: 1710000000000,
    email: "无邮箱",
    message: "无法解析提交内容",
    sourceDomain: "source.example",
  })
})

test("duplicate spam cleanup scans beyond the visible page before deleting", async () => {
  const selectOffsets: number[] = []
  const deleteBatches: unknown[][] = []

  const rows = Array.from({ length: 501 }, (_, index) => ({
    id: `spam-${index}`,
    data: JSON.stringify({
      email: index === 500 ? "first@example.com" : `unique-${index}@example.com`,
      message: `spam ${index}`,
    }),
    created_at: 2_000 - index,
    request_origin: "https://source.example",
  }))
  rows[0] = {
    ...rows[0],
    data: JSON.stringify({
      email: "first@example.com",
      message: "latest duplicate",
    }),
  }

  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async all() {
              assert.match(sql, /SELECT id, data, created_at, request_origin/)
              const limit = Number(values[0])
              const offset = Number(values[1])
              selectOffsets.push(offset)
              return { results: rows.slice(offset, offset + limit) }
            },
            async run() {
              assert.match(sql, /DELETE FROM submissions WHERE id IN/)
              deleteBatches.push(values)
              return { success: true }
            },
          }
        },
      }
    },
  }

  const deleted = await deleteDuplicateSpamRows(db as never)

  assert.equal(deleted, 1)
  assert.deepEqual(selectOffsets, [0, 500])
  assert.deepEqual(deleteBatches, [["spam-500"]])
})
