import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

test("submission inbox exposes a one-click spam action and hides metadata fields", () => {
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
  assert.match(route, /spamHiddenIds/)
  assert.match(route, /setSpamHiddenIds/)
  assert.match(route, /getVisibleSubmissionEntries/)
  assert.match(detailPanel, /标为垃圾邮件/)
  assert.match(columns, /标为垃圾邮件/)
  assert.match(columns, /const spamColumn/)
  assert.match(columns, /return \[starColumn, spamColumn, timeColumn/)
  assert.doesNotMatch(route, /确定将这 \$\{selectedIds\.length\} 条提交标为垃圾邮件吗/)
  assert.doesNotMatch(columns, /confirm\("确定将此提交标为垃圾邮件吗？"\)/)
  assert.doesNotMatch(detailPanel, /confirm\("确定将此提交标为垃圾邮件吗？"\)/)
})

test("spam page can restore quarantined submissions", () => {
  const spamRoute = readFileSync(
    join(process.cwd(), "app", "routes", "forms.spam.tsx"),
    "utf8"
  )

  assert.match(spamRoute, /intent === "restore_spam"/)
  assert.match(spamRoute, /UPDATE submissions SET is_spam = 0/)
  assert.match(spamRoute, /还原/)
})

test("spam page can permanently delete quarantined submissions", () => {
  const spamRoute = readFileSync(
    join(process.cwd(), "app", "routes", "forms.spam.tsx"),
    "utf8"
  )

  assert.match(spamRoute, /intent === "delete_spam"/)
  assert.match(spamRoute, /DELETE FROM submissions WHERE id = \?/)
  assert.match(spamRoute, /删除/)
  assert.match(spamRoute, /confirm\("确定永久删除这条垃圾邮件吗？"\)/)
})

test("spam page supports bulk selection and bulk delete", () => {
  const spamRoute = readFileSync(
    join(process.cwd(), "app", "routes", "forms.spam.tsx"),
    "utf8"
  )

  assert.match(spamRoute, /selectedIds/)
  assert.match(spamRoute, /toggleAllSelected/)
  assert.match(spamRoute, /type="checkbox"/)
  assert.match(spamRoute, /intent" value="delete_spam_bulk"/)
  assert.match(spamRoute, /DELETE FROM submissions WHERE id IN/)
  assert.match(spamRoute, /DELETE_SPAM_CHUNK_SIZE/)
  assert.match(spamRoute, /deleteSpamRowsByIds/)
  assert.match(spamRoute, /批量删除/)
})

test("spam page keeps one row per repeated spam mailbox by default", () => {
  const spamRoute = readFileSync(
    join(process.cwd(), "app", "routes", "forms.spam.tsx"),
    "utf8"
  )

  assert.match(spamRoute, /dedupeSpamSubmissionsByEmail/)
  assert.match(spamRoute, /duplicateSubmissionIds/)
  assert.match(spamRoute, /intent" value="delete_duplicate_spam"/)
  assert.match(spamRoute, /loadSpamSubmissions/)
  assert.match(spamRoute, /deleteSpamRowsByIds\(database, duplicateSubmissionIds\)/)
  assert.doesNotMatch(spamRoute, /duplicateSubmissionIds\.map\(\(id\) => \(\s*<input/)
  assert.match(spamRoute, /清理重复邮箱/)
})

test("spam page returns visible errors when cleanup actions fail", () => {
  const spamRoute = readFileSync(
    join(process.cwd(), "app", "routes", "forms.spam.tsx"),
    "utf8"
  )

  assert.match(spamRoute, /try \{/)
  assert.match(spamRoute, /Failed to delete duplicate spam submissions/)
  assert.match(spamRoute, /清理重复垃圾邮件失败，请刷新后重试。/)
  assert.match(spamRoute, /role="alert"/)
  assert.match(spamRoute, /actionError/)
})

test("submission intake suppresses detected spam before storage side effects", () => {
  const intakeRoute = readFileSync(
    join(process.cwd(), "app", "routes", "api.forms.$formId.submissions.tsx"),
    "utf8"
  )

  assert.match(intakeRoute, /const isSpam = isSpamSubmission\(submissionData\)/)
  assert.match(intakeRoute, /if \(isSpam\) {/)
  assert.match(intakeRoute, /suppressedSpam: true/)
  assert.match(intakeRoute, /INSERT INTO submissions/)
  assert.doesNotMatch(intakeRoute, /COALESCE\(is_spam, 0\) = 1\s+AND created_at/)
})
