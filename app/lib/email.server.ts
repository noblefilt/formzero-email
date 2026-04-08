import nodemailer from "nodemailer"
import type { EmailConfig } from "#/types/settings"
import type { SubmissionEmailData } from "#/types/submission"

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

    // Format the submission data for email display
    const submissionHtml = formatSubmissionData(submission.data)
    const submissionText = formatSubmissionDataText(submission.data)

    // Format timestamp
    const timestamp = new Date(submission.createdAt).toLocaleString('zh-CN', {
      dateStyle: 'full',
      timeStyle: 'long',
    })

    // Send email
    await transporter.sendMail({
      from: config.notification_email,
      to: config.notification_email,
      subject: `「${submission.formName}」收到新提交`,
      text: `
FormZero - 新表单提交

您的表单「${submission.formName}」收到了一条新提交。

提交详情
==================
表单：${submission.formName}
提交 ID：${submission.id}
接收时间：${timestamp}

提交数据
==============
${submissionText}

---
此邮件由 FormZero 自动发送
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>新表单提交</title>
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
                新表单提交
              </h1>
              <p style="margin: 8px 0 0 0; color: #b4b4b4; font-size: 16px;">
                ${submission.formName}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">

              <!-- Introduction -->
              <p style="margin: 0 0 24px 0; color: #252525; font-size: 16px; line-height: 1.6;">
                您的表单 <strong>${submission.formName}</strong> 收到了一条新提交。
              </p>

              <!-- Metadata -->
              <div style="background-color: #fafafa; border-left: 4px solid #252525; padding: 16px; margin-bottom: 32px; border-radius: 6px;">
                <table width="100%" cellpadding="4" cellspacing="0">
                  <tr>
                    <td style="color: #8e8e8e; font-size: 14px; font-weight: 500; padding: 4px 0;">提交 ID：</td>
                    <td style="color: #252525; font-size: 14px; font-family: 'Courier New', monospace; padding: 4px 0;">${submission.id}</td>
                  </tr>
                  <tr>
                    <td style="color: #8e8e8e; font-size: 14px; font-weight: 500; padding: 4px 0;">接收时间：</td>
                    <td style="color: #252525; font-size: 14px; padding: 4px 0;">${timestamp}</td>
                  </tr>
                </table>
              </div>

              <!-- Submission Data -->
              <h2 style="margin: 0 0 16px 0; color: #252525; font-size: 18px; font-weight: 600;">
                提交数据
              </h2>

              ${submissionHtml}

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

/**
 * Formats submission data as HTML table
 */
function formatSubmissionData(data: Record<string, any>): string {
  const entries = Object.entries(data)

  if (entries.length === 0) {
    return '<p style="color: #8e8e8e; font-style: italic;">无提交数据</p>'
  }

  const rows = entries
    .map(([key, value]) => {
      const displayKey = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase())

      let displayValue = formatValue(value)

      return `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #ebebeb; color: #8e8e8e; font-size: 14px; font-weight: 500; vertical-align: top; width: 35%;">
            ${escapeHtml(displayKey)}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #ebebeb; color: #252525; font-size: 14px; vertical-align: top;">
            ${displayValue}
          </td>
        </tr>
      `
    })
    .join('')

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ebebeb; border-radius: 6px; overflow: hidden;">
      ${rows}
    </table>
  `
}

/**
 * Formats submission data as plain text
 */
function formatSubmissionDataText(data: Record<string, any>): string {
  const entries = Object.entries(data)

  if (entries.length === 0) {
    return '无提交数据'
  }

  return entries
    .map(([key, value]) => {
      const displayKey = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase())

      return `${displayKey}: ${formatValueText(value)}`
    })
    .join('\n')
}

/**
 * Formats a value for HTML display
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '<span style="color: #b4b4b4; font-style: italic;">未提供</span>'
  }

  if (typeof value === 'boolean') {
    return value ? '✓ 是' : '✗ 否'
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '<span style="color: #b4b4b4; font-style: italic;">空列表</span>'
    }
    return '<ul style="margin: 0; padding-left: 20px;">' +
      value.map(item => `<li>${escapeHtml(String(item))}</li>`).join('') +
      '</ul>'
  }

  if (typeof value === 'object') {
    return '<pre style="margin: 0; padding: 8px; background-color: #fafafa; border-radius: 6px; font-size: 13px; overflow-x: auto; color: #252525;">' +
      escapeHtml(JSON.stringify(value, null, 2)) +
      '</pre>'
  }

  // Check if it looks like a URL
  const stringValue = String(value)
  if (stringValue.match(/^https?:\/\//)) {
    return `<a href="${escapeHtml(stringValue)}" style="color: #252525; text-decoration: underline;">${escapeHtml(stringValue)}</a>`
  }

  // Check if it looks like an email
  if (stringValue.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return `<a href="mailto:${escapeHtml(stringValue)}" style="color: #252525; text-decoration: underline;">${escapeHtml(stringValue)}</a>`
  }

  return escapeHtml(stringValue)
}

/**
 * Formats a value for plain text display
 */
function formatValueText(value: any): string {
  if (value === null || value === undefined) {
    return '(未提供)'
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否'
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '(空列表)'
    }
    return '\n  - ' + value.map(item => String(item)).join('\n  - ')
  }

  if (typeof value === 'object') {
    return '\n' + JSON.stringify(value, null, 2)
  }

  return String(value)
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
