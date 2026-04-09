export type ExportIssue = {
  level: "error" | "warning"
  message: string
}

export type ExportResult = {
  ok: boolean
  html: string
  warnings: ExportIssue[]
  errors: ExportIssue[]
  generatedAt: string
}
