import nodemailer from "nodemailer"
import type { EmailConfig } from "#/types/settings"
import type { SubmissionEmailData } from "#/types/submission"
import {
  getSubmissionEmail,
  getSubmissionMessage,
  getSubmissionName,
} from "#/lib/submission-spam"

type SubmissionNotificationMessage = {
  from: string
  to: string
  replyTo?: string
  subject: string
  text: string
  html: string
}

const GENERIC_FORM_NAMES = new Set([
  "contact",
  "contact form",
  "default",
  "form",
  "general",
  "main form",
  "website form",
])

function sanitizeHeaderText(value: string | null | undefined) {
  if (!value) return null

  const cleaned = value
    .replace(/[\r\n]+/g, " ")
    .replace(/["<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()

  return cleaned || null
}

function formatAddress(name: string | null | undefined, email: string) {
  const cleanedName = sanitizeHeaderText(name)

  if (!cleanedName) return email

  return `${cleanedName} <${email}>`
}

function getCustomerVisibleSiteName(
  config: EmailConfig,
  formName: string
) {
  const configuredSiteName = sanitizeHeaderText(config.public_site_name)
  if (configuredSiteName) return configuredSiteName

  const cleanedFormName = sanitizeHeaderText(formName)
  if (!cleanedFormName) return null

  if (GENERIC_FORM_NAMES.has(cleanedFormName.toLowerCase())) return null

  return cleanedFormName
}

export function buildInquirySubject({
  siteName,
  senderName,
  senderEmail,
}: {
  siteName?: string | null
  senderName?: string | null
  senderEmail?: string | null
}) {
  const cleanedSiteName = sanitizeHeaderText(siteName)
  const cleanedSender = sanitizeHeaderText(senderName) || sanitizeHeaderText(senderEmail)

  if (cleanedSiteName && cleanedSender) {
    return `${cleanedSiteName} inquiry from ${cleanedSender}`
  }

  if (cleanedSender) {
    return `New inquiry from ${cleanedSender}`
  }

  if (cleanedSiteName) {
    return `${cleanedSiteName} inquiry`
  }

  return "New website inquiry"
}

export function buildTestEmailMessage(config: EmailConfig): SubmissionNotificationMessage {
  const siteName = sanitizeHeaderText(config.public_site_name)
  const fromName =
    sanitizeHeaderText(config.from_name) ||
    siteName ||
    "FormZero"
  const fromEmail = config.from_email || config.notification_email
  const toEmail = config.notification_to_email || config.notification_email
  const subject = siteName
    ? `${siteName} email settings test`
    : "FormZero email settings test"
  const scope = siteName ? ` for ${siteName}` : ""

  return {
    from: formatAddress(fromName, fromEmail),
    to: toEmail,
    subject,
    text: `This test confirms that your FormZero SMTP settings can send email${scope}. Future form notifications will use this sender identity and notification inbox.`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email settings test</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; color: #222222;">
  <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700;">
    Email settings test passed
  </p>
  <p style="margin: 0; font-size: 15px; line-height: 1.7;">
    This test confirms that your FormZero SMTP settings can send email${escapeHtml(scope)}. Future form notifications will use this sender identity and notification inbox.
  </p>
</body>
</html>
    `.trim(),
  }
}

/**
 * Sends a test email to verify SMTP settings
 */
export async function sendTestEmail(
  config: EmailConfig
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      auth: {
        user: config.notification_email,
        pass: config.notification_email_password,
      },
    })

    const info = await transporter.sendMail(buildTestEmailMessage(config))

    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("Error sending test email:", error)

    // Provide more specific error message
    let errorMessage = "发送测试邮件失败"
    if (error instanceof Error) {
      if (error.message.includes("Invalid login")) {
        errorMessage = "邮箱或密码错误"
      } else if (error.message.includes("ENOTFOUND") || error.message.includes("ECONNREFUSED")) {
        errorMessage = "无法连接到 SMTP 服务器"
      } else {
        errorMessage = error.message
      }
    }

    return { success: false, error: errorMessage }
  }
}

/**
 * Sends a notification email when a new form submission is received
 */
export async function sendSubmissionNotification(
  config: EmailConfig,
  submission: SubmissionEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      auth: {
        user: config.notification_email,
        pass: config.notification_email_password,
      },
    })

    const message = buildSubmissionNotificationMessage(config, submission)

    // Send email
    await transporter.sendMail(message)

    return { success: true }
  } catch (error) {
    console.error("Error sending notification email:", error)

    let errorMessage = "发送通知邮件失败"
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return { success: false, error: errorMessage }
  }
}

export function buildSubmissionNotificationMessage(
  config: EmailConfig,
  submission: SubmissionEmailData
): SubmissionNotificationMessage {
  const senderEmail = getSubmissionEmail(submission.data)
  const senderName =
    getSubmissionName(submission.data) || senderEmail || submission.formName
  const primaryMessage = getSubmissionMessage(submission.data)
  const cleanSenderName = sanitizeHeaderText(senderName)
  const siteName = getCustomerVisibleSiteName(config, submission.formName)
  const fromName =
    cleanSenderName ||
    sanitizeHeaderText(config.from_name) ||
    siteName ||
    "Website inquiry"
  const fromEmail = config.from_email || config.notification_email
  const toEmail = config.notification_to_email || config.notification_email

  const textParts = [
    senderName,
    senderEmail,
    primaryMessage,
  ].filter(Boolean)

  return {
    from: formatAddress(fromName, fromEmail),
    to: toEmail,
    replyTo: senderEmail || undefined,
    subject: buildInquirySubject({
      siteName,
      senderName,
      senderEmail,
    }),
    text: textParts.join("\n\n"),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New message</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; color: #222222;">
  <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">
    ${escapeHtml(senderName)}
  </p>
  ${senderEmail ? `<p style="margin: 0 0 24px 0; font-size: 14px;"><a href="mailto:${escapeHtml(senderEmail)}" style="color: #1155cc; text-decoration: underline;">${escapeHtml(senderEmail)}</a></p>` : ""}
  <p style="margin: 0; font-size: 16px; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(primaryMessage || "No message provided.")}</p>
</body>
</html>
    `.trim(),
  }
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}
