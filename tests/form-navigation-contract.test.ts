import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const formsRoute = readFileSync(
  join(process.cwd(), "app", "routes", "forms.tsx"),
  "utf8"
)
const formNav = readFileSync(
  join(process.cwd(), "app", "components", "form-nav.tsx"),
  "utf8"
)
const formLayout = readFileSync(
  join(process.cwd(), "app", "routes", "forms.$formId.tsx"),
  "utf8"
)

assert.match(
  formsRoute,
  /ORDER BY unread_count DESC, f\.created_at ASC/,
  "form list should sort forms with more unread submissions first"
)

assert.doesNotMatch(
  formNav,
  /<span>垃圾邮件<\/span>/,
  "sidebar spam navigation should not render the visible spam text label"
)

assert.match(
  formNav,
  /<SidebarMenuItem className="flex items-center justify-between gap-2">/,
  "dashboard row should justify the label and spam summary to opposite edges"
)

assert.match(
  formNav,
  /<NavLink to="\/forms\/spam" aria-label="垃圾邮件">/,
  "spam summary should link to the spam inbox with an accessible label"
)

assert.match(
  formNav,
  /<span className="min-w-4 text-right tabular-nums">\{spamCount\}<\/span>/,
  "spam summary should always show the numeric spam count"
)

assert.match(
  formLayout,
  /删除表单/,
  "current form layout should expose a visible delete form action"
)

assert.match(
  formLayout,
  /此操作不可撤销/,
  "delete form action should confirm permanent data loss"
)

assert.match(
  formLayout,
  /name="intent" value="delete"/,
  "delete form dialog should submit the existing delete intent"
)
