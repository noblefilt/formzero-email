import assert from "node:assert/strict"
import test from "node:test"

import { deleteSpamRowsByIds } from "../app/routes/forms.spam"

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
