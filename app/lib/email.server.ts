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

    // Send test email
    const info = await transporter.sendMail({
      from: config.notification_email,
      to: config.notification_email,
      subject: "FormZero - 测试邮件",
      text: "这是一封来自 FormZero 的测试邮件。您的 SMTP 设置已正确配置！",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #252525; padding: 32px; text-align: center; border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
              <h1 style="margin: 0; color: #fafafa; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">
                测试邮件
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; color: #252525; font-size: 16px; line-height: 1.6;">
                这是一封来自 <strong>FormZero</strong> 的测试邮件。
              </p>
              <p style="margin: 0; color: #252525; font-size: 16px; line-height: 1.6;">
                您的 SMTP 设置已正确配置！
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 32px; text-align: center; border-top: 1px solid #ebebeb;">
              <p style="margin: 0; color: #8e8e8e; font-size: 14px;">
                由 <strong style="color: #595959;">FormZero</strong> 发送
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    })

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
  const fromName = senderName.replace(/["<>]/g, "").trim() || submission.formName

  const textParts = [
    senderName,
    senderEmail,
    primaryMessage,
  ].filter(Boolean)

  return {
    from: `${fromName} <${config.notification_email}>`,
    to: config.notification_email,
    replyTo: senderEmail || undefined,
    subject: `来自 ${senderName} 的消息`,
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
