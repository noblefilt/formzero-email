import type { EmailBlock } from "../blocks/types"

export type TemplateStatus = "draft" | "starter"

export type EmailDocument = {
  id: string
  name: string
  subject: string
  previewText: string
  blocks: EmailBlock[]
  updatedAt: string
  schemaVersion: 1
}

export type EmailTemplateRecord = {
  id: string
  name: string
  status: TemplateStatus
  summary: string
  updatedAt: string
  document: EmailDocument
}

export type EmailTemplateVersionRecord = {
  id: string
  templateId: string
  templateName: string
  versionNumber: number
  createdAt: string
  document: EmailDocument
}

export type EditorBootstrapData = {
  storageReady: boolean
  storageMessage: string | null
  templates: EmailTemplateRecord[]
  versionsByTemplate: Record<string, EmailTemplateVersionRecord[]>
}
