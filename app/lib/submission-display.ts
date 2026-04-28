const HIDDEN_SUBMISSION_FIELDS = new Set([
  "_gotcha",
  "_redirect",
  "source",
  "request_source",
  "page_url",
  "pageurl",
  "page_url_",
  "page",
  "referrer",
  "referer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
])

const FIELD_LABELS: Record<string, string> = {
  name: "姓名",
  full_name: "姓名",
  fullname: "姓名",
  your_name: "姓名",
  email: "邮箱",
  "e-mail": "邮箱",
  mail: "邮箱",
  message: "消息",
  msg: "消息",
  comments: "消息",
  comment: "消息",
  body: "消息",
}

export function normalizeSubmissionFieldKey(key: string) {
  return key.trim().toLowerCase().replace(/\s+/g, "_")
}

export function isHiddenSubmissionField(key: string) {
  return HIDDEN_SUBMISSION_FIELDS.has(normalizeSubmissionFieldKey(key))
}

export function getVisibleSubmissionEntries(data: Record<string, unknown>) {
  return Object.entries(data).filter(([key]) => !isHiddenSubmissionField(key))
}

export function getSubmissionFieldLabel(key: string) {
  const normalized = normalizeSubmissionFieldKey(key)
  return FIELD_LABELS[normalized] ?? key
}
