import assert from "node:assert/strict"
import test from "node:test"

import {
  getSubmissionFieldLabel,
  getVisibleSubmissionEntries,
  isHiddenSubmissionField,
} from "./submission-display"

test("submission display hides source metadata but keeps user fields", () => {
  const entries = getVisibleSubmissionEntries({
    name: "Ada",
    email: "ada@example.com",
    message: "Hello",
    source: "modal",
    page_url: "https://example.com/contact",
    _gotcha: "bot",
  })

  assert.deepEqual(entries, [
    ["name", "Ada"],
    ["email", "ada@example.com"],
    ["message", "Hello"],
  ])
  assert.equal(isHiddenSubmissionField("Source"), true)
  assert.equal(isHiddenSubmissionField("PAGE_URL"), true)
  assert.equal(getSubmissionFieldLabel("message"), "消息")
})
