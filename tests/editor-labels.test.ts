import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { blockRegistry } from "../src/blocks/registry"

test("editor shows Chinese labels while keeping English block types", () => {
  const editorShell = readFileSync(
    join(process.cwd(), "src", "editor", "editor-shell.tsx"),
    "utf8"
  )

  assert.match(editorShell, /个人邮件模板/)
  assert.match(editorShell, /导出 HTML/)
  assert.match(editorShell, /撤销/)
  assert.doesNotMatch(editorShell, /Professional Email Editor/)
  assert.doesNotMatch(editorShell, /Reusable modules/)

  assert.deepEqual(
    blockRegistry.map((definition) => definition.type),
    ["text", "image", "button", "divider", "spacer", "html"]
  )
  assert.deepEqual(
    blockRegistry.map((definition) => definition.label),
    ["文本", "图片", "按钮", "分割线", "间距", "HTML"]
  )
})
