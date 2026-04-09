import type { EmailBlock } from "../blocks/types"
import { validateBlock } from "../blocks/registry"
import type { EmailDocument } from "../templates/types"
import type { ExportIssue, ExportResult } from "./types"

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderBlock(block: EmailBlock) {
  if (block.type === "text") {
    return `<tr><td style="padding: 0 0 24px 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.7; color: black; text-align: ${block.align};">${escapeHtml(block.content)}</td></tr>`
  }

  if (block.type === "image") {
    return `<tr><td style="padding: 0 0 24px 0;"><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" style="display: block; width: 100%; border: 0; border-radius: 12px;" /></td></tr>`
  }

  if (block.type === "button") {
    return `<tr><td style="padding: 0 0 24px 0; text-align: ${block.align};"><a href="${escapeHtml(block.href)}" style="display: inline-block; padding: 14px 24px; border-radius: 9999px; background: black; color: white; text-decoration: none; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold;">${escapeHtml(block.label)}</a></td></tr>`
  }

  if (block.type === "divider") {
    const tone = block.tone === "strong" ? "black" : "silver"
    return `<tr><td style="padding: 0 0 24px 0;"><hr style="border: 0; border-top: 1px solid ${tone}; margin: 0;" /></td></tr>`
  }

  if (block.type === "spacer") {
    return `<tr><td style="height: ${block.size}px; font-size: 0; line-height: 0;">&nbsp;</td></tr>`
  }

  return `<tr><td style="padding: 0 0 24px 0;">${block.html}</td></tr>`
}

export function renderEmailHtml(document: EmailDocument): ExportResult {
  const generatedAt = new Date().toISOString()
  const issues: ExportIssue[] = []

  if (!document.subject.trim()) {
    issues.push({
      level: "error",
      message: "Subject is required before export.",
    })
  }

  document.blocks.forEach((block) => {
    validateBlock(block).forEach((issue) => issues.push(issue))
  })

  const errors = issues.filter((issue) => issue.level === "error")
  const warnings = issues.filter((issue) => issue.level === "warning")

  const body = document.blocks.map((block) => renderBlock(block)).join("")

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(document.subject || document.name)}</title>
  </head>
  <body style="margin: 0; padding: 32px; background: white;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; margin: 0 auto;">
      <tr>
        <td style="padding: 0 0 16px 0; font-family: Arial, sans-serif; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: dimgray;">
          ${escapeHtml(document.previewText)}
        </td>
      </tr>
      ${body}
    </table>
  </body>
</html>`

  return {
    ok: errors.length === 0,
    html,
    warnings,
    errors,
    generatedAt,
  }
}
