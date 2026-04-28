import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

test("submission inbox exposes a manual spam action and hides metadata fields", () => {
  const route = readFileSync(
    join(process.cwd(), "app", "routes", "forms.$formId.submissions.tsx"),
    "utf8"
  )
  const detailPanel = readFileSync(
    join(
      process.cwd(),
      "app",
      "routes",
      "forms.$formId.submissions",
      "detail-panel.tsx"
    ),
    "utf8"
  )
  const columns = readFileSync(
    join(
      process.cwd(),
      "app",
      "routes",
      "forms.$formId.submissions",
      "columns.tsx"
    ),
    "utf8"
  )

  assert.match(route, /intent === "mark_spam"/)
  assert.match(route, /UPDATE submissions SET is_spam = 1/)
  assert.match(route, /getVisibleSubmissionEntries/)
  assert.match(detailPanel, /标为垃圾邮件/)
  assert.match(columns, /标为垃圾邮件/)
})
