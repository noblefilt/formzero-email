import type {
  FormDetails,
  FormSummary,
  GetSettingsResponse,
  ListFormsResponse,
  ListSpamResponse,
  ListSubmissionsResponse,
  SubmissionSummary,
} from "./client.js"

function formatTimestamp(value: number | null) {
  if (!value) return "n/a"
  return new Date(value).toISOString()
}

function formatSender(submission: SubmissionSummary) {
  if (submission.senderName && submission.senderEmail) {
    return `${submission.senderName} <${submission.senderEmail}>`
  }
  return submission.senderName || submission.senderEmail || "Unknown sender"
}

function formatSubmissionBlock(submission: SubmissionSummary) {
  const lines = [
    `- \`${submission.id}\` | ${formatSender(submission)} | ${formatTimestamp(submission.createdAt)}`,
    `  form: ${submission.formName || submission.formId}`,
    `  source domain: ${submission.sourceDomain}`,
    `  message: ${submission.message || "(no message field found)"}`,
  ]

  if (submission.parseError) {
    lines.push("  parse warning: submission payload could not be parsed cleanly")
  }

  if (submission.visibleFields.length > 0) {
    lines.push("  visible fields:")
    for (const field of submission.visibleFields) {
      lines.push(`  ${field.label}: ${field.value}`)
    }
  }

  return lines.join("\n")
}

export function renderFormsMarkdown(result: ListFormsResponse) {
  const lines = [
    `Forms: ${result.count}/${result.total} shown`,
    `Offset: ${result.offset} | Limit: ${result.limit} | Has more: ${result.hasMore}`,
    "",
  ]

  if (result.forms.length === 0) {
    lines.push("No forms found.")
    return lines.join("\n")
  }

  for (const form of result.forms) {
    lines.push(
      `- \`${form.id}\` | ${form.name} | submissions: ${form.submissionCount} | unread: ${form.unreadCount} | spam: ${form.spamCount} | last submission: ${formatTimestamp(form.lastSubmissionAt)}`
    )
  }

  return lines.join("\n")
}

export function renderFormMarkdown(form: FormDetails) {
  return [
    `Form: \`${form.id}\``,
    `Name: ${form.name}`,
    `Created: ${formatTimestamp(form.createdAt)}`,
    `Updated: ${formatTimestamp(form.updatedAt)}`,
    `Submissions: ${form.submissionCount} | unread: ${form.unreadCount} | archived: ${form.archivedCount} | spam: ${form.spamCount}`,
    `Last submission: ${formatTimestamp(form.lastSubmissionAt)}`,
    "",
    "Notification settings:",
    `- inbox: ${form.settings.notificationToEmail || form.settings.notificationEmail || "not configured"}`,
    `- public site name: ${form.settings.publicSiteName || "not configured"}`,
    `- from name: ${form.settings.fromName || "not configured"}`,
    `- from email: ${form.settings.fromEmail || "not configured"}`,
    `- smtp host: ${form.settings.smtpHost || "not configured"}:${form.settings.smtpPort || "n/a"}`,
    `- allowed origins: ${form.settings.allowedOrigins.length > 0 ? form.settings.allowedOrigins.join(", ") : "none"}`,
    `- webhook url: ${form.settings.webhookUrl || "not configured"}`,
    `- has notification password: ${form.settings.hasNotificationPassword}`,
    `- has webhook secret: ${form.settings.hasWebhookSecret}`,
    `- has server token: ${form.settings.hasServerToken}`,
  ].join("\n")
}

export function renderSubmissionsMarkdown(result: ListSubmissionsResponse) {
  const lines = [
    `Form: \`${result.form.id}\` (${result.form.name})`,
    `Submissions: ${result.count}/${result.total} shown`,
    `Offset: ${result.offset} | Limit: ${result.limit} | Has more: ${result.hasMore}`,
    "",
  ]

  if (result.submissions.length === 0) {
    lines.push("No submissions found for this filter.")
    return lines.join("\n")
  }

  for (const submission of result.submissions) {
    lines.push(formatSubmissionBlock(submission))
    lines.push("")
  }

  return lines.join("\n").trim()
}

export function renderSubmissionMarkdown(submission: SubmissionSummary) {
  return formatSubmissionBlock(submission)
}

export function renderSpamMarkdown(result: ListSpamResponse) {
  const lines = [
    `Spam: ${result.count}/${result.total} shown`,
    `Offset: ${result.offset} | Limit: ${result.limit} | Has more: ${result.hasMore}`,
    `Dedupe by email: ${result.dedupeByEmail} | hidden duplicates: ${result.hiddenDuplicateCount}`,
    "",
  ]

  if (result.spam.length === 0) {
    lines.push("No spam records found.")
    return lines.join("\n")
  }

  for (const submission of result.spam) {
    lines.push(formatSubmissionBlock(submission))
    lines.push("")
  }

  return lines.join("\n").trim()
}

export function renderSettingsMarkdown(result: GetSettingsResponse) {
  if (!result.settings) {
    return "Global notification settings are not configured."
  }

  return [
    "Global notification settings:",
    `- smtp login email: ${result.settings.notificationEmail || "not configured"}`,
    `- notification inbox: ${result.settings.notificationToEmail || result.settings.notificationEmail || "not configured"}`,
    `- public site name: ${result.settings.publicSiteName || "not configured"}`,
    `- from name: ${result.settings.fromName || "not configured"}`,
    `- from email: ${result.settings.fromEmail || "not configured"}`,
    `- smtp host: ${result.settings.smtpHost || "not configured"}:${result.settings.smtpPort || "n/a"}`,
    `- has notification password: ${result.settings.hasNotificationPassword}`,
    `- updated at: ${formatTimestamp(result.settings.updatedAt)}`,
  ].join("\n")
}

export function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

export function summarizeFormList(forms: FormSummary[]) {
  return forms.map((form) => ({
    id: form.id,
    name: form.name,
    unreadCount: form.unreadCount,
    submissionCount: form.submissionCount,
    spamCount: form.spamCount,
  }))
}
