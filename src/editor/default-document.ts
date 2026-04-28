import type { EmailTemplateRecord } from "../templates/types"

const now = new Date().toISOString()

export const blankTemplate: EmailTemplateRecord = {
  id: "draft-blank-template",
  name: "Blank Draft",
  status: "draft",
  summary: "Start from a clean document and build block by block.",
  updatedAt: now,
  document: {
    id: "draft-blank-template",
    name: "Blank Draft",
    subject: "Draft your next announcement",
    previewText: "Use this workspace to shape a new campaign.",
    updatedAt: now,
    schemaVersion: 1,
    blocks: [
      {
        id: "draft-blank-template-text",
        type: "text",
        content: "Introduce the message with a sharp opening paragraph.",
        align: "left",
      },
      {
        id: "draft-blank-template-button",
        type: "button",
        label: "Launch campaign",
        href: "https://example.com",
        align: "left",
      },
    ],
  },
}
