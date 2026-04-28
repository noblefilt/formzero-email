import { useEffect, useState } from "react"
import { data, useFetcher, useLoaderData, useParams } from "react-router"
import type { Route } from "./+types/forms.$formId.integration"
import {
  Check,
  Copy,
  Lock,
  Mail,
  RotateCcw,
  Server,
  Webhook,
} from "lucide-react"
import { Highlight, themes } from "prism-react-renderer"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { ResultButton } from "~/components/result-button"
import {
  formatAllowedOrigins,
  parseAllowedOrigins,
} from "~/lib/allowed-origins"
import { requireAuth } from "~/lib/require-auth.server"
import {
  generateServerToken,
  hashServerToken,
} from "~/lib/server-token"
import { deliverWebhook } from "~/lib/webhooks"

type CopyState = "idle" | "success" | "error"
type CodeSnippetId = "html" | "javascript" | "react" | "server"

type AllowedOriginsActionData = {
  success?: boolean
  error?: string
  invalidOrigins?: string[]
  allowedOrigins?: string[]
}

type WebhookSettingsActionData = {
  success?: boolean
  error?: string
}

type ServerTokenActionData = {
  success?: boolean
  error?: string
  serverToken?: string
  revoked?: boolean
}

type ReplayWebhookActionData = {
  success?: boolean
  error?: string
  deliveryId?: string
}

type WebhookDelivery = {
  id: string
  submission_id: string
  target_url: string
  status: "pending" | "delivered" | "failed"
  status_code: number | null
  error_message: string | null
  attempt_number: number
  replayed_from_delivery_id: string | null
  created_at: number
  delivered_at: number | null
}

const SMTP_CONFIGS: Record<string, { host: string; port: number; hint: string }> = {
  "gmail.com": {
    host: "smtp.gmail.com",
    port: 587,
    hint: "Gmail 请使用应用专用密码（Google 账户 → 安全性 → 应用专用密码）。",
  },
  "outlook.com": {
    host: "smtp-mail.outlook.com",
    port: 587,
    hint: "Outlook 请使用 Microsoft 账户密码或应用专用密码。",
  },
  "hotmail.com": {
    host: "smtp-mail.outlook.com",
    port: 587,
    hint: "Hotmail 请使用 Microsoft 账户密码或应用专用密码。",
  },
  "yahoo.com": {
    host: "smtp.mail.yahoo.com",
    port: 587,
    hint: "Yahoo 请在账户安全设置中生成应用专用密码。",
  },
  "icloud.com": {
    host: "smtp.mail.me.com",
    port: 587,
    hint: "iCloud 请使用 appleid.apple.com 的 App 专用密码。",
  },
}

function getEmailDomain(email: string): string | null {
  const match = email.match(/@(.+)$/)
  return match ? match[1].toLowerCase() : null
}

function getWebhookUrlError(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  try {
    const url = new URL(trimmedValue)

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Webhook URL 仅支持 http:// 或 https:// 地址。"
    }

    return null
  } catch {
    return "Webhook URL 格式无效，请输入完整地址。"
  }
}

function normalizeWebhookUrl(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const url = new URL(trimmedValue)

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Webhook URL 仅支持 http:// 或 https:// 地址。")
  }

  return url.toString()
}

function formatTimestamp(timestamp: number | null) {
  if (!timestamp) {
    return "未完成"
  }

  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false,
  })
}

function getDeliveryStatusLabel(status: WebhookDelivery["status"]) {
  if (status === "delivered") {
    return "已送达"
  }

  if (status === "failed") {
    return "失败"
  }

  return "投递中"
}

function getDeliveryStatusClassName(status: WebhookDelivery["status"]) {
  if (status === "delivered") {
    return "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300"
  }

  if (status === "failed") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
  }

  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
}

function CodeExample({
  code,
  language,
  copyState,
  onCopy,
}: {
  code: string
  language: "markup" | "javascript" | "jsx"
  copyState: CopyState
  onCopy: () => void
}) {
  const copyLabel =
    copyState === "success"
      ? "Copied"
      : copyState === "error"
        ? "Copy failed"
        : "Copy"

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCopy}
        className="absolute top-3 right-3 z-10 h-8 border-white/15 bg-white/10 px-2.5 text-xs text-white shadow-none hover:bg-white/20 hover:text-white"
      >
        {copyState === "success" ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        <span>{copyLabel}</span>
      </Button>
      <Highlight theme={themes.vsDark} code={code} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={className}
            style={{
              ...style,
              margin: 0,
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
              padding: "3.25rem 0.75rem 0.75rem",
              overflowX: "auto",
            }}
          >
            {tokens.map((line, index) => (
              <div key={index} {...getLineProps({ line })}>
                {line.map((token, tokenIndex) => (
                  <span key={tokenIndex} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  )
}

export const meta: Route.MetaFunction = () => {
  return [
    { title: "集成 | FormZero" },
    { name: "description", content: "使用 HTML、JavaScript 或 React 集成您的表单" },
  ]
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const database = context.cloudflare.env.DB
  await requireAuth(request, database, context.cloudflare.env)

  const formSettings = await database
    .prepare(
      `
        SELECT
          notification_email,
          notification_email_password,
          smtp_host,
          smtp_port,
          allowed_origins,
          webhook_url,
          webhook_secret,
          server_token_hash
        FROM forms
        WHERE id = ?
      `
    )
    .bind(params.formId)
    .first<{
      notification_email: string | null
      notification_email_password: string | null
      smtp_host: string | null
      smtp_port: number | null
      allowed_origins: string | null
      webhook_url: string | null
      webhook_secret: string | null
      server_token_hash: string | null
    }>()

  const webhookDeliveries = await database
    .prepare(
      `
        SELECT
          id,
          submission_id,
          target_url,
          status,
          status_code,
          error_message,
          attempt_number,
          replayed_from_delivery_id,
          created_at,
          delivered_at
        FROM webhook_deliveries
        WHERE form_id = ?
        ORDER BY created_at DESC
        LIMIT 20
      `
    )
    .bind(params.formId)
    .all<WebhookDelivery>()

  return {
    formEmail:
      formSettings && formSettings.notification_email
        ? {
            notification_email: formSettings.notification_email,
            notification_email_password:
              formSettings.notification_email_password || "",
            smtp_host: formSettings.smtp_host || "",
            smtp_port: formSettings.smtp_port || 587,
          }
        : null,
    allowedOrigins: formSettings?.allowed_origins || "",
    webhookSettings: {
      url: formSettings?.webhook_url || "",
      hasSecret: Boolean(formSettings?.webhook_secret),
    },
    hasServerToken: Boolean(formSettings?.server_token_hash),
    webhookDeliveries: webhookDeliveries.results || [],
  }
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const database = context.cloudflare.env.DB
  await requireAuth(request, database, context.cloudflare.env)

  if (request.method === "DELETE") {
    await database
      .prepare(
        "UPDATE forms SET notification_email = NULL, notification_email_password = NULL, smtp_host = NULL, smtp_port = NULL WHERE id = ?"
      )
      .bind(params.formId)
      .run()
    return data({ success: true })
  }

  const formData = await request.formData()
  const intent = formData.get("intent") as string | null

  if (intent === "update-allowed-origins") {
    const allowedOriginsInput = formData.get("allowed_origins") as string | null
    const parsedAllowedOrigins = parseAllowedOrigins(allowedOriginsInput)

    if (parsedAllowedOrigins.invalidEntries.length > 0) {
      return data(
        {
          success: false,
          error: "来源白名单中包含无效地址，请使用完整的 http:// 或 https:// origin。",
          invalidOrigins: parsedAllowedOrigins.invalidEntries,
        },
        { status: 400 }
      )
    }

    const storedOrigins =
      parsedAllowedOrigins.origins.length > 0
        ? formatAllowedOrigins(parsedAllowedOrigins.origins)
        : null

    await database
      .prepare("UPDATE forms SET allowed_origins = ? WHERE id = ?")
      .bind(storedOrigins, params.formId)
      .run()

    return data({
      success: true,
      allowedOrigins: parsedAllowedOrigins.origins,
    })
  }

  if (intent === "update-webhook-settings") {
    const webhookUrlInput = (formData.get("webhook_url") as string | null) || ""
    const webhookSecretInput =
      (formData.get("webhook_secret") as string | null)?.trim() || ""

    const currentSettings = await database
      .prepare("SELECT webhook_secret FROM forms WHERE id = ?")
      .bind(params.formId)
      .first<{ webhook_secret: string | null }>()

    const hasStoredSecret = Boolean(currentSettings?.webhook_secret)

    if (!webhookUrlInput.trim() && !webhookSecretInput) {
      await database
        .prepare(
          "UPDATE forms SET webhook_url = NULL, webhook_secret = NULL WHERE id = ?"
        )
        .bind(params.formId)
        .run()

      return data({ success: true })
    }

    if (!webhookUrlInput.trim()) {
      return data(
        {
          success: false,
          error: "请输入 Webhook URL，或清空 URL 和 secret 以停用 Webhook。",
        },
        { status: 400 }
      )
    }

    let normalizedWebhookUrl: string

    try {
      normalizedWebhookUrl = normalizeWebhookUrl(webhookUrlInput) || ""
    } catch (error) {
      return data(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Webhook URL 格式无效，请输入完整地址。",
        },
        { status: 400 }
      )
    }

    if (!webhookSecretInput && !hasStoredSecret) {
      return data(
        {
          success: false,
          error: "首次启用 Webhook 时必须提供签名 secret。",
        },
        { status: 400 }
      )
    }

    const nextWebhookSecret =
      webhookSecretInput || currentSettings?.webhook_secret || null

    await database
      .prepare("UPDATE forms SET webhook_url = ?, webhook_secret = ? WHERE id = ?")
      .bind(normalizedWebhookUrl, nextWebhookSecret, params.formId)
      .run()

    return data({ success: true })
  }

  if (intent === "generate-server-token") {
    const serverToken = generateServerToken()
    const serverTokenHash = await hashServerToken(serverToken)

    await database
      .prepare("UPDATE forms SET server_token_hash = ? WHERE id = ?")
      .bind(serverTokenHash, params.formId)
      .run()

    return data({
      success: true,
      serverToken,
    })
  }

  if (intent === "revoke-server-token") {
    await database
      .prepare("UPDATE forms SET server_token_hash = NULL WHERE id = ?")
      .bind(params.formId)
      .run()

    return data({
      success: true,
      revoked: true,
    })
  }

  if (intent === "replay-webhook") {
    const deliveryId = (formData.get("delivery_id") as string | null)?.trim()

    if (!deliveryId) {
      return data(
        {
          success: false,
          error: "缺少要重放的 delivery 记录。",
        },
        { status: 400 }
      )
    }

    const replayTarget = await database
      .prepare(
        `
          SELECT
            d.id,
            d.submission_id,
            s.data AS submission_data,
            s.created_at AS submission_created_at,
            s.idempotency_key,
            s.request_origin,
            s.request_source,
            f.name AS form_name,
            f.webhook_url,
            f.webhook_secret
          FROM webhook_deliveries d
          INNER JOIN submissions s ON s.id = d.submission_id
          INNER JOIN forms f ON f.id = d.form_id
          WHERE d.form_id = ? AND d.id = ?
          LIMIT 1
        `
      )
      .bind(params.formId, deliveryId)
      .first<{
        id: string
        submission_id: string
        submission_data: string
        submission_created_at: number
        idempotency_key: string | null
        request_origin: string | null
        request_source: string | null
        form_name: string
        webhook_url: string | null
        webhook_secret: string | null
      }>()

    if (!replayTarget) {
      return data(
        {
          success: false,
          error: "未找到要重放的 delivery 记录。",
        },
        { status: 404 }
      )
    }

    if (!replayTarget.webhook_url || !replayTarget.webhook_secret) {
      return data(
        {
          success: false,
          error: "当前表单未配置可用的 Webhook URL 和 secret。",
        },
        { status: 400 }
      )
    }

    const replayResult = await deliverWebhook({
      db: database,
      form: {
        id: params.formId,
        name: replayTarget.form_name,
        webhook_url: replayTarget.webhook_url,
        webhook_secret: replayTarget.webhook_secret,
      },
      submission: {
        id: replayTarget.submission_id,
        createdAt: replayTarget.submission_created_at,
        idempotencyKey: replayTarget.idempotency_key,
        source: replayTarget.request_source || "unknown",
        origin: replayTarget.request_origin,
        data: JSON.parse(replayTarget.submission_data),
      },
      replayedFromDeliveryId: replayTarget.id,
    })

    if (!replayResult.success) {
      return data(
        {
          success: false,
          error: "Webhook 已重放，但最新一次投递失败。请查看最新 delivery log。",
          deliveryId: replayResult.deliveryId,
        },
        { status: 502 }
      )
    }

    return data({
      success: true,
      deliveryId: replayResult.deliveryId,
    })
  }

  const notification_email = formData.get("notification_email") as string
  const notification_email_password = formData.get(
    "notification_email_password"
  ) as string
  const smtp_host = formData.get("smtp_host") as string
  const smtp_port = formData.get("smtp_port") as string

  if (
    !notification_email ||
    !notification_email_password ||
    !smtp_host ||
    !smtp_port
  ) {
    return data({ success: false, error: "所有字段均为必填" }, { status: 400 })
  }

  await database
    .prepare(
      "UPDATE forms SET notification_email = ?, notification_email_password = ?, smtp_host = ?, smtp_port = ? WHERE id = ?"
    )
    .bind(
      notification_email,
      notification_email_password,
      smtp_host,
      parseInt(smtp_port, 10),
      params.formId
    )
    .run()

  return data({ success: true })
}

export default function IntegrationPage() {
  const params = useParams()
  const formId = params.formId
  const { formEmail, allowedOrigins, webhookSettings, hasServerToken, webhookDeliveries } =
    useLoaderData<typeof loader>()
  const [endpointCopyState, setEndpointCopyState] = useState<CopyState>("idle")
  const [codeCopyState, setCodeCopyState] = useState<{
    target: CodeSnippetId | null
    state: CopyState
  }>({
    target: null,
    state: "idle",
  })

  const formEndpoint =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/forms/${formId}/submissions`
      : `/api/forms/${formId}/submissions`

  const handleCopyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(formEndpoint)
      setEndpointCopyState("success")
    } catch {
      setEndpointCopyState("error")
    }

    setTimeout(() => setEndpointCopyState("idle"), 2000)
  }

  const handleCopyCode = async (target: CodeSnippetId, code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCodeCopyState({ target, state: "success" })
    } catch {
      setCodeCopyState({ target, state: "error" })
    }

    setTimeout(() => {
      setCodeCopyState((current) =>
        current.target === target ? { target: null, state: "idle" } : current
      )
    }, 2000)
  }

  const htmlExample = `<form action="${formEndpoint}" method="POST" accept-charset="UTF-8">
  <label>
    Full name
    <input type="text" name="name" placeholder="Jane Doe" required />
  </label>

  <label>
    Email address
    <input type="email" name="email" placeholder="jane@example.com" required />
  </label>

  <label>
    Message
    <textarea
      name="message"
      rows="5"
      placeholder="Tell us how we can help."
      required
    ></textarea>
  </label>

  <!-- Translate visible labels, placeholders, and success copy for your live site. -->
  <!-- Keep helper names such as _gotcha and _redirect unchanged. -->
  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="display:none" />
  <input type="hidden" name="_redirect" value="https://your-site.com/thank-you" />

  <button type="submit">Send message</button>
</form>`

  const jsExample = `const endpoint = '${formEndpoint}'
const idempotencyKey = crypto.randomUUID()

// Browser requests do not need a server token.
// If this site's domain/origin is allowed, FormZero will continue to accept it.
const payload = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  message: 'I would like a quote for a custom email template.',
  _gotcha: '',
}

fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify(payload),
})
  .then(async (response) => {
    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Submission failed')
    }

    return result
  })
  .then(({ id, duplicate }) => {
    console.log(duplicate ? 'Submission already recorded:' : 'Submission stored:', id)
  })
  .catch((error) => {
    console.error(error.message)
  })`

  const reactExample = `import { useState } from 'react'

const endpoint = '${formEndpoint}'

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  })
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const updateField = (field) => (event) => {
    setFormData((current) => ({
      ...current,
      [field]: event.target.value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus('submitting')
    setError('')

    try {
      const idempotencyKey = crypto.randomUUID()
      const payload = {
        ...formData,
        _gotcha: '',
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Submission failed')
      }

      setStatus('success')
      setFormData({ name: '', email: '', message: '' })
    } catch (error) {
      setStatus('error')
      setError(error instanceof Error ? error.message : 'Submission failed')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Keep visible copy aligned with the language used on your live site. */}
      <input
        type="text"
        placeholder="Jane Doe"
        value={formData.name}
        onChange={updateField('name')}
        required
      />
      <input
        type="email"
        placeholder="jane@example.com"
        value={formData.email}
        onChange={updateField('email')}
        required
      />
      <textarea
        placeholder="Tell us how we can help."
        value={formData.message}
        onChange={updateField('message')}
        required
      />
      <button type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Sending...' : 'Send message'}
      </button>
      {status === 'success' && <p>Thanks. Your message has been sent.</p>}
      {status === 'error' && <p>{error}</p>}
    </form>
  )
}`

  const serverExample = `const endpoint = '${formEndpoint}'
const serverToken = process.env.FORMZERO_SERVER_TOKEN
const idempotencyKey = \`erp-order-\${orderId}\`

const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Idempotency-Key': idempotencyKey,
}

// Optional: only send this header if you enabled Server Token for direct server-to-server traffic.
if (serverToken) {
  headers.Authorization = \`Bearer \${serverToken}\`
}

const response = await fetch(endpoint, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    email: 'ops@example.com',
    message: 'Direct server submission',
    externalOrderId: orderId,
  }),
})

const result = await response.json()

if (!response.ok || !result.success) {
  throw new Error(result.error || 'Submission failed')
}

console.log(result.duplicate ? 'Existing submission reused:' : 'Submission stored:', result.id)`

  return (
    <div className="flex flex-1 flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle>接口地址</CardTitle>
          <CardDescription>
            将此地址用作 HTML 表单的{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">action</code>{" "}
            URL，或直接发送 JSON 数据。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 break-all rounded-md bg-muted px-3 py-2 text-xs font-mono">
              {formEndpoint}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyEndpoint}
              className="w-full shrink-0 sm:w-auto sm:px-3"
            >
              {endpointCopyState === "success" ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied</span>
                </>
              ) : endpointCopyState === "error" ? (
                <span>Copy failed</span>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy endpoint</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration Examples</CardTitle>
          <CardDescription>
            Pick the stack you ship with. The browser examples already include
            the default spam and duplicate-submission guards; the server example
            shows the optional direct-call token flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Use your site&apos;s language</p>
            <p className="mt-1 text-muted-foreground">
              Translate labels, placeholders, and confirmation text for the
              language used on your live site. Keep helper names such as{" "}
              <code className="rounded bg-background px-1 py-0.5 text-xs">
                _gotcha
              </code>{" "}
              and{" "}
              <code className="rounded bg-background px-1 py-0.5 text-xs">
                _redirect
              </code>{" "}
              unchanged when you use them. If your browser page runs on an
              allowed domain/origin, you do not need a server token to keep
              receiving non-spam submissions and notification emails.
            </p>
          </div>
          <Tabs defaultValue="html" className="w-full">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="html">HTML</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="react">React</TabsTrigger>
              <TabsTrigger value="server">Server</TabsTrigger>
            </TabsList>

            <TabsContent value="html" className="mt-3">
              <CodeExample
                code={htmlExample}
                language="markup"
                copyState={
                  codeCopyState.target === "html" ? codeCopyState.state : "idle"
                }
                onCopy={() => handleCopyCode("html", htmlExample)}
              />
            </TabsContent>

            <TabsContent value="javascript" className="mt-3">
              <CodeExample
                code={jsExample}
                language="javascript"
                copyState={
                  codeCopyState.target === "javascript"
                    ? codeCopyState.state
                    : "idle"
                }
                onCopy={() => handleCopyCode("javascript", jsExample)}
              />
            </TabsContent>

            <TabsContent value="react" className="mt-3">
              <CodeExample
                code={reactExample}
                language="jsx"
                copyState={
                  codeCopyState.target === "react" ? codeCopyState.state : "idle"
                }
                onCopy={() => handleCopyCode("react", reactExample)}
              />
            </TabsContent>

            <TabsContent value="server" className="mt-3">
              <CodeExample
                code={serverExample}
                language="javascript"
                copyState={
                  codeCopyState.target === "server"
                    ? codeCopyState.state
                    : "idle"
                }
                onCopy={() => handleCopyCode("server", serverExample)}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>提交后跳转</CardTitle>
          <CardDescription>控制用户提交表单后的跳转目标。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-muted p-3">
              <p className="mb-1 font-medium">方式一：隐藏字段</p>
              <code className="text-xs">
                {
                  '<input type="hidden" name="_redirect" value="https://yoursite.com/thanks" />'
                }
              </code>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="mb-1 font-medium">方式二：查询参数</p>
              <code className="break-all text-xs">
                {formEndpoint}?redirect=https://yoursite.com/thanks
              </code>
            </div>
            <p className="text-muted-foreground">
              如未指定跳转地址，用户将看到默认的提交成功页面，并带有“返回”按钮。
            </p>
          </div>
        </CardContent>
      </Card>

      <IdempotencyKeyGuide formEndpoint={formEndpoint} />

      <AllowedOriginsSettings allowedOrigins={allowedOrigins} />

      <ServerTokenSettings
        formEndpoint={formEndpoint}
        hasServerToken={hasServerToken}
      />

      <WebhookSettings
        webhookUrl={webhookSettings.url}
        hasWebhookSecret={webhookSettings.hasSecret}
      />

      <WebhookDeliveryLog deliveries={webhookDeliveries} />

      <FormEmailSettings formEmail={formEmail} />
    </div>
  )
}

function IdempotencyKeyGuide({ formEndpoint }: { formEndpoint: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle")

  const idempotencyExample = `const idempotencyKey = 'lead-2026-0001'

const response = await fetch('${formEndpoint}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify({
    email: 'jane@example.com',
    message: 'Retry-safe submission',
  }),
})

const result = await response.json()

if (result.duplicate) {
  console.log('Existing submission reused:', result.id)
}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(idempotencyExample)
      setCopyState("success")
    } catch {
      setCopyState("error")
    }

    setTimeout(() => setCopyState("idle"), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Idempotency-Key</CardTitle>
        <CardDescription>
          为弱网重试和重复提交提供一次性写入保障。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium">如何生效</p>
          <p className="mt-1 text-muted-foreground">
            同一个表单、同一个{" "}
            <code className="rounded bg-background px-1 py-0.5 text-xs">
              Idempotency-Key
            </code>{" "}
            再次提交时，会直接复用第一次的 submission ID，不会重复写库，也不会重复触发邮件与 Webhook。
          </p>
        </div>
        <CodeExample
          code={idempotencyExample}
          language="javascript"
          copyState={copyState}
          onCopy={handleCopy}
        />
        <p className="text-sm text-muted-foreground">
          HTML 原生表单无法附带自定义请求头；如果你需要幂等提交，请使用{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">fetch</code>{" "}
          或服务端直连。
        </p>
      </CardContent>
    </Card>
  )
}

function AllowedOriginsSettings({ allowedOrigins }: { allowedOrigins: string }) {
  const saveFetcher = useFetcher<AllowedOriginsActionData>()
  const [allowedOriginsInput, setAllowedOriginsInput] = useState(allowedOrigins)
  const [defaultOrigin, setDefaultOrigin] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    setDefaultOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    if (allowedOrigins.trim()) {
      setAllowedOriginsInput(allowedOrigins)
      return
    }

    setAllowedOriginsInput(defaultOrigin)
  }, [allowedOrigins, defaultOrigin])

  useEffect(() => {
    if (saveFetcher.state !== "idle" || !saveFetcher.data?.success) {
      return
    }

    setAllowedOriginsInput(
      formatAllowedOrigins(saveFetcher.data.allowedOrigins || [])
    )
  }, [saveFetcher.state, saveFetcher.data])

  const parsedAllowedOrigins = parseAllowedOrigins(allowedOriginsInput)
  const hasInvalidOrigins = parsedAllowedOrigins.invalidEntries.length > 0
  const isSaving = saveFetcher.state === "submitting"
  const isSaved = saveFetcher.state === "idle" && Boolean(saveFetcher.data?.success)

  return (
    <Card>
      <CardHeader>
        <CardTitle>允许来源</CardTitle>
        <CardDescription>
          为浏览器提交添加站点白名单。默认会预填当前站点 domain，清空后才会允许任意网站提交。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <saveFetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="update-allowed-origins" />

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">生产环境建议</p>
            <p className="mt-1 text-muted-foreground">
              默认会先带入当前站点的 origin。你也可以替换为正式站点域名，并为每个可信网站填写一个 origin，例如{" "}
              <code className="rounded bg-background px-1 py-0.5 text-xs">
                https://www.example.com
              </code>
              。旧表单不需要额外配置 Server Token，只要浏览器请求域名匹配这里的来源规则，就会继续接收提交并发送邮件通知。无{" "}
              <code className="rounded bg-background px-1 py-0.5 text-xs">
                Origin
              </code>{" "}
              的服务端请求不受此列表限制，但启用了 Server Token 后仍需附带有效 token。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowed-origins">来源白名单</Label>
            <Textarea
              id="allowed-origins"
              name="allowed_origins"
              rows={5}
              placeholder={`https://www.example.com\nhttps://app.example.com`}
              value={allowedOriginsInput}
              onChange={(event) => setAllowedOriginsInput(event.target.value)}
              aria-invalid={hasInvalidOrigins}
            />
            <p
              className={
                hasInvalidOrigins
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {hasInvalidOrigins
                ? `以下条目无效：${parsedAllowedOrigins.invalidEntries.join("、")}`
                : parsedAllowedOrigins.origins.length > 0
                  ? `将允许 ${parsedAllowedOrigins.origins.length} 个来源。保存后会自动标准化为纯 origin，路径与查询参数会被忽略。`
                  : "当前已切换为允许所有来源，任何网站都可以发起浏览器提交。"}
            </p>
          </div>

          {saveFetcher.data?.error && (
            <p className="text-sm text-destructive">{saveFetcher.data.error}</p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <ResultButton
              type="submit"
              isSubmitting={isSaving}
              isSuccess={isSaved}
              loadingText="保存中..."
              successText="已保存"
              disabled={hasInvalidOrigins}
            >
              保存来源规则
            </ResultButton>
            <Button
              type="button"
              variant="outline"
              disabled={!allowedOriginsInput.trim()}
              onClick={() => setAllowedOriginsInput("")}
            >
              允许所有来源
            </Button>
          </div>
        </saveFetcher.Form>
      </CardContent>
    </Card>
  )
}

function ServerTokenSettings({
  formEndpoint,
  hasServerToken,
}: {
  formEndpoint: string
  hasServerToken: boolean
}) {
  const generateFetcher = useFetcher<ServerTokenActionData>()
  const revokeFetcher = useFetcher<ServerTokenActionData>()
  const [revealedToken, setRevealedToken] = useState<string | null>(null)
  const [hasActiveToken, setHasActiveToken] = useState(hasServerToken)
  const [tokenCopyState, setTokenCopyState] = useState<CopyState>("idle")
  const [exampleCopyState, setExampleCopyState] = useState<CopyState>("idle")

  useEffect(() => {
    setHasActiveToken(hasServerToken)
  }, [hasServerToken])

  useEffect(() => {
    if (generateFetcher.state !== "idle" || !generateFetcher.data?.serverToken) {
      return
    }

    setRevealedToken(generateFetcher.data.serverToken)
    setHasActiveToken(true)
  }, [generateFetcher.state, generateFetcher.data])

  useEffect(() => {
    if (revokeFetcher.state !== "idle" || !revokeFetcher.data?.success) {
      return
    }

    setRevealedToken(null)
    setHasActiveToken(false)
  }, [revokeFetcher.state, revokeFetcher.data])

  const serverExample = `const serverToken = process.env.FORMZERO_SERVER_TOKEN
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Idempotency-Key': 'erp-order-2026-0001',
}

if (serverToken) {
  headers.Authorization = \`Bearer \${serverToken}\`
}

const response = await fetch('${formEndpoint}', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    email: 'ops@example.com',
    message: 'Direct server submission',
  }),
})

const result = await response.json()`

  const handleCopyToken = async () => {
    if (!revealedToken) {
      return
    }

    try {
      await navigator.clipboard.writeText(revealedToken)
      setTokenCopyState("success")
    } catch {
      setTokenCopyState("error")
    }

    setTimeout(() => setTokenCopyState("idle"), 2000)
  }

  const handleCopyExample = async () => {
    try {
      await navigator.clipboard.writeText(serverExample)
      setExampleCopyState("success")
    } catch {
      setExampleCopyState("error")
    }

    setTimeout(() => setExampleCopyState("idle"), 2000)
  }

  const isGenerating = generateFetcher.state === "submitting"
  const isGenerated =
    generateFetcher.state === "idle" && Boolean(generateFetcher.data?.success)
  const isRevoking = revokeFetcher.state === "submitting"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Server Token</CardTitle>
        <CardDescription>
          可选的高级能力，用来区分浏览器 allowlist 和服务端直连权限；旧表单的浏览器接入不需要改这里。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium">生效规则</p>
          <p className="mt-1 text-muted-foreground">
            浏览器请求继续按来源白名单校验，只要域名匹配就能继续正常提交并触发邮件通知；无{" "}
            <code className="rounded bg-background px-1 py-0.5 text-xs">
              Origin
            </code>{" "}
            的服务端直连请求，在启用 token 后必须带上{" "}
            <code className="rounded bg-background px-1 py-0.5 text-xs">
              Authorization: Bearer ...
            </code>{" "}
            或{" "}
            <code className="rounded bg-background px-1 py-0.5 text-xs">
              x-formzero-token
            </code>
            。
          </p>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium">
            {hasActiveToken ? "当前已启用服务端 token" : "当前未启用服务端 token"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {hasActiveToken
              ? "如果 token 丢失，只能重新生成。重新生成后旧 token 会立即失效。"
              : "不启用也不会影响已有浏览器表单；只有你要做无 Origin 的服务端直连时，才需要打开它。"}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <generateFetcher.Form method="post">
            <input type="hidden" name="intent" value="generate-server-token" />
            <ResultButton
              type="submit"
              isSubmitting={isGenerating}
              isSuccess={isGenerated}
              loadingText="生成中..."
              successText="已生成"
            >
              {hasActiveToken ? "重新生成 token" : "生成 token"}
            </ResultButton>
          </generateFetcher.Form>

          {hasActiveToken && (
            <revokeFetcher.Form method="post">
              <input type="hidden" name="intent" value="revoke-server-token" />
              <Button
                type="submit"
                variant="outline"
                disabled={isGenerating || isRevoking}
              >
                <RotateCcw className="h-4 w-4" />
                {isRevoking ? "撤销中..." : "撤销 token"}
              </Button>
            </revokeFetcher.Form>
          )}
        </div>

        {(generateFetcher.data?.error || revokeFetcher.data?.error) && (
          <p className="text-sm text-destructive">
            {generateFetcher.data?.error || revokeFetcher.data?.error}
          </p>
        )}

        {revealedToken && (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">新 token 仅显示这一次</p>
                <p className="text-xs text-muted-foreground">
                  请立即复制到你的服务端环境变量或密钥管理系统。
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleCopyToken}>
                {tokenCopyState === "success" ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied</span>
                  </>
                ) : tokenCopyState === "error" ? (
                  <span>Copy failed</span>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy token</span>
                  </>
                )}
              </Button>
            </div>
            <code className="block break-all rounded-md bg-background px-3 py-2 text-xs font-mono">
              {revealedToken}
            </code>
          </div>
        )}

        <CodeExample
          code={serverExample}
          language="javascript"
          copyState={exampleCopyState}
          onCopy={handleCopyExample}
        />
      </CardContent>
    </Card>
  )
}

function WebhookSettings({
  webhookUrl,
  hasWebhookSecret,
}: {
  webhookUrl: string
  hasWebhookSecret: boolean
}) {
  const saveFetcher = useFetcher<WebhookSettingsActionData>()
  const [webhookUrlInput, setWebhookUrlInput] = useState(webhookUrl)
  const [webhookSecretInput, setWebhookSecretInput] = useState("")
  const [hasStoredSecret, setHasStoredSecret] = useState(hasWebhookSecret)
  const [receiverCopyState, setReceiverCopyState] = useState<CopyState>("idle")

  useEffect(() => {
    setWebhookUrlInput(webhookUrl)
    setWebhookSecretInput("")
    setHasStoredSecret(hasWebhookSecret)
  }, [webhookUrl, hasWebhookSecret])

  useEffect(() => {
    if (saveFetcher.state !== "idle" || !saveFetcher.data?.success) {
      return
    }

    const webhookEnabled = webhookUrlInput.trim().length > 0
    setHasStoredSecret(webhookEnabled)
    setWebhookSecretInput("")
  }, [saveFetcher.state, saveFetcher.data, webhookUrlInput])

  const webhookUrlError = getWebhookUrlError(webhookUrlInput)
  const missingUrlError =
    !webhookUrlInput.trim() && webhookSecretInput.trim()
      ? "请输入 Webhook URL，或清空 URL 和 secret 以停用 Webhook。"
      : null
  const missingSecretError =
    webhookUrlInput.trim() && !webhookSecretInput.trim() && !hasStoredSecret
      ? "首次启用 Webhook 时必须提供签名 secret。"
      : null
  const clientError =
    webhookUrlError || missingUrlError || missingSecretError || null
  const isSaving = saveFetcher.state === "submitting"
  const isSaved = saveFetcher.state === "idle" && Boolean(saveFetcher.data?.success)
  const webhookReceiverExample = `const encoder = new TextEncoder()

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function signFormZeroPayload(secret, timestamp, rawBody) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(\`\${timestamp}.\${rawBody}\`),
  )

  return \`sha256=\${toHex(signature)}\`
}

export async function handleFormZeroWebhook(request) {
  const rawBody = await request.text()
  const timestamp = request.headers.get('x-formzero-timestamp') || ''
  const incomingSignature = request.headers.get('x-formzero-signature') || ''

  const expectedSignature = await signFormZeroPayload(
    process.env.FORMZERO_WEBHOOK_SECRET,
    timestamp,
    rawBody,
  )

  if (!timestamp || incomingSignature !== expectedSignature) {
    return new Response('invalid signature', { status: 401 })
  }

  const event = JSON.parse(rawBody)

  if (event.event === 'submission.created') {
    console.log('submission id:', event.submission.id)
    console.log('idempotency key:', event.submission.idempotencyKey)
  }

  return new Response('ok')
}`

  const handleCopyReceiverExample = async () => {
    try {
      await navigator.clipboard.writeText(webhookReceiverExample)
      setReceiverCopyState("success")
    } catch {
      setReceiverCopyState("error")
    }

    setTimeout(() => setReceiverCopyState("idle"), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook Signing</CardTitle>
        <CardDescription>
          对每次投递进行签名，并将投递结果写入 delivery log 以便追踪和重放。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <saveFetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="update-webhook-settings" />

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">签名头说明</p>
            <div className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
              <p>X-FormZero-Event: submission.created</p>
              <p>X-FormZero-Delivery-Id: &lt;delivery id&gt;</p>
              <p>X-FormZero-Timestamp: &lt;ISO timestamp&gt;</p>
              <p>X-FormZero-Signature: sha256=&lt;hmac hex&gt;</p>
            </div>
            <p className="mt-2 text-muted-foreground">
              签名计算方式为{" "}
              <code className="rounded bg-background px-1 py-0.5 text-xs">
                HMAC_SHA256(secret, timestamp + "." + rawBody)
              </code>
              。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              name="webhook_url"
              type="url"
              placeholder="https://ops.example.com/webhooks/formzero"
              value={webhookUrlInput}
              onChange={(event) => setWebhookUrlInput(event.target.value)}
              aria-invalid={Boolean(webhookUrlError || missingUrlError)}
            />
            <p className="text-sm text-muted-foreground">
              清空 URL 和 secret 后保存，可停用 Webhook。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-secret">签名 Secret</Label>
            <Input
              id="webhook-secret"
              name="webhook_secret"
              type="password"
              placeholder={hasStoredSecret ? "Leave blank to keep the current secret" : "whsec_..."}
              value={webhookSecretInput}
              onChange={(event) => setWebhookSecretInput(event.target.value)}
              aria-invalid={Boolean(missingSecretError)}
            />
            <p className="text-sm text-muted-foreground">
              {hasStoredSecret
                ? "当前已存在签名 secret。留空保存会继续使用现有 secret。"
                : "首次启用 Webhook 时必须提供签名 secret。"}
            </p>
          </div>

          {(clientError || saveFetcher.data?.error) && (
            <p className="text-sm text-destructive">
              {clientError || saveFetcher.data?.error}
            </p>
          )}

          <ResultButton
            type="submit"
            isSubmitting={isSaving}
            isSuccess={isSaved}
            loadingText="保存中..."
            successText="已保存"
            disabled={Boolean(clientError)}
          >
            保存 Webhook 配置
          </ResultButton>

          <div className="space-y-2 border-t pt-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Webhook 接收示例</p>
              <p className="text-sm text-muted-foreground">
                下面的示例已经包含签名校验逻辑，复制后只需要换成你的环境变量名和业务处理代码。
              </p>
            </div>
            <CodeExample
              code={webhookReceiverExample}
              language="javascript"
              copyState={receiverCopyState}
              onCopy={handleCopyReceiverExample}
            />
          </div>
        </saveFetcher.Form>
      </CardContent>
    </Card>
  )
}

function WebhookDeliveryLog({ deliveries }: { deliveries: WebhookDelivery[] }) {
  const replayFetcher = useFetcher<ReplayWebhookActionData>()
  const replayingDeliveryId =
    replayFetcher.state === "submitting"
      ? replayFetcher.formData?.get("delivery_id")?.toString() || null
      : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook Delivery Log</CardTitle>
        <CardDescription>
          跟踪“投递到了没”，并支持基于现有 submission 重新投递。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium">重放规则</p>
          <p className="mt-1 text-muted-foreground">
            重放会基于原始 submission 新增一条 delivery log，并使用当前表单保存的 Webhook URL 与 secret 重新签名发送。
          </p>
        </div>

        {replayFetcher.data?.error && (
          <p className="text-sm text-destructive">{replayFetcher.data.error}</p>
        )}

        {replayFetcher.data?.success && replayFetcher.data.deliveryId && (
          <p className="text-sm text-green-600 dark:text-green-400">
            已创建新的 delivery 记录：{replayFetcher.data.deliveryId}
          </p>
        )}

        {deliveries.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            还没有 Webhook 投递记录。配置 Webhook 并收到第一条 submission 后，这里会显示最近 20 条 delivery。
          </div>
        ) : (
          <div className="space-y-3">
            {deliveries.map((delivery) => {
              const isReplaying = replayingDeliveryId === delivery.id

              return (
                <div
                  key={delivery.id}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getDeliveryStatusClassName(delivery.status)}`}
                        >
                          {getDeliveryStatusLabel(delivery.status)}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Attempt #{delivery.attempt_number}
                        </span>
                        {delivery.replayed_from_delivery_id && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            Replay of {delivery.replayed_from_delivery_id}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          创建时间：{formatTimestamp(delivery.created_at)}
                        </p>
                        <p>
                          完成时间：{formatTimestamp(delivery.delivered_at)}
                        </p>
                        <p>
                          状态码：
                          <span className="ml-1 font-mono text-foreground">
                            {delivery.status_code ?? "n/a"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <replayFetcher.Form method="post">
                      <input type="hidden" name="intent" value="replay-webhook" />
                      <input type="hidden" name="delivery_id" value={delivery.id} />
                      <Button type="submit" variant="outline" disabled={Boolean(replayingDeliveryId)}>
                        <Webhook className="h-4 w-4" />
                        {isReplaying ? "重放中..." : "重放"}
                      </Button>
                    </replayFetcher.Form>
                  </div>

                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Delivery ID</p>
                      <code className="block break-all rounded-md bg-muted px-3 py-2 text-xs">
                        {delivery.id}
                      </code>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Submission ID</p>
                      <code className="block break-all rounded-md bg-muted px-3 py-2 text-xs">
                        {delivery.submission_id}
                      </code>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground">Target URL</p>
                    <code className="block break-all rounded-md bg-muted px-3 py-2 text-xs">
                      {delivery.target_url}
                    </code>
                  </div>

                  {delivery.error_message && (
                    <div className="space-y-1 text-sm">
                      <p className="text-muted-foreground">错误信息</p>
                      <div className="rounded-md border border-red-200 bg-red-50/80 px-3 py-2 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                        {delivery.error_message}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FormEmailSettings({
  formEmail,
}: {
  formEmail: {
    notification_email: string
    notification_email_password: string
    smtp_host: string
    smtp_port: number
  } | null
}) {
  const saveFetcher = useFetcher<{ success?: boolean; error?: string }>()
  const clearFetcher = useFetcher<{ success?: boolean }>()
  const testFetcher = useFetcher<{ success?: boolean; error?: string }>()

  const [email, setEmail] = useState(formEmail?.notification_email || "")
  const [password, setPassword] = useState(
    formEmail?.notification_email_password || ""
  )
  const [smtpHost, setSmtpHost] = useState(formEmail?.smtp_host || "")
  const [smtpPort, setSmtpPort] = useState(
    formEmail?.smtp_port?.toString() || ""
  )
  const [testPassed, setTestPassed] = useState(!!formEmail)

  const domain = getEmailDomain(email)
  const smtpConfig = domain ? SMTP_CONFIGS[domain] || null : null

  useEffect(() => {
    if (smtpConfig) {
      setSmtpHost(smtpConfig.host)
      setSmtpPort(smtpConfig.port.toString())
    }
  }, [smtpConfig?.host, smtpConfig?.port])

  useEffect(() => {
    setTestPassed(false)
  }, [email, password, smtpHost, smtpPort])

  const isTesting = testFetcher.state === "submitting"
  const testSuccess = testFetcher.state === "idle" && testFetcher.data?.success

  useEffect(() => {
    if (testSuccess) {
      setTestPassed(true)
    }
  }, [testSuccess])

  const isSaving = saveFetcher.state === "submitting"
  const isSaved = saveFetcher.state === "idle" && saveFetcher.data?.success

  useEffect(() => {
    if (clearFetcher.state === "idle" && clearFetcher.data?.success) {
      setEmail("")
      setPassword("")
      setSmtpHost("")
      setSmtpPort("")
      setTestPassed(false)
    }
  }, [clearFetcher.state, clearFetcher.data])

  const handleTest = () => {
    const formData = new FormData()
    formData.append("notification_email", email)
    formData.append("notification_email_password", password)
    formData.append("smtp_host", smtpHost)
    formData.append("smtp_port", smtpPort)
    testFetcher.submit(formData, {
      method: "post",
      action: "/settings/notifications/test",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>邮件通知</CardTitle>
        <CardDescription>
          覆盖此表单的全局邮件设置。留空则使用全局设置。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <saveFetcher.Form method="post">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                通知邮箱
              </Label>
              <Input
                id="form-email"
                name="notification_email"
                type="email"
                placeholder="notifications@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            {domain && (
              <>
                <div className="space-y-2">
                  <Label
                    htmlFor="form-password"
                    className="flex items-center gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    SMTP 密码
                  </Label>
                  <Input
                    id="form-password"
                    name="notification_email_password"
                    type="password"
                    placeholder="请输入 SMTP 密码"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  {smtpConfig && (
                    <p className="text-xs text-muted-foreground">
                      {smtpConfig.hint}
                    </p>
                  )}
                </div>

                {!smtpConfig && (
                  <>
                    <div className="space-y-2">
                      <Label
                        htmlFor="form-smtp-host"
                        className="flex items-center gap-2"
                      >
                        <Server className="h-4 w-4" />
                        SMTP 主机
                      </Label>
                      <Input
                        id="form-smtp-host"
                        name="smtp_host"
                        placeholder="smtp.example.com"
                        value={smtpHost}
                        onChange={(event) => setSmtpHost(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="form-smtp-port">SMTP 端口</Label>
                      <Input
                        id="form-smtp-port"
                        name="smtp_port"
                        type="number"
                        placeholder="587"
                        value={smtpPort}
                        onChange={(event) => setSmtpPort(event.target.value)}
                        required
                      />
                    </div>
                  </>
                )}

                {smtpConfig && (
                  <>
                    <input type="hidden" name="smtp_host" value={smtpHost} />
                    <input type="hidden" name="smtp_port" value={smtpPort} />
                  </>
                )}

                {testFetcher.data?.error && (
                  <p className="text-sm text-destructive">
                    {testFetcher.data.error}
                  </p>
                )}

                <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !email || !password || !smtpHost || !smtpPort || isTesting
                    }
                    onClick={handleTest}
                  >
                    {isTesting
                      ? "测试中..."
                      : testSuccess
                        ? "测试通过！"
                        : "发送测试邮件"}
                  </Button>
                  <Button type="submit" disabled={!testPassed || isSaving}>
                    {isSaving ? "保存中..." : isSaved ? "已保存！" : "保存"}
                  </Button>
                  {formEmail && (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        clearFetcher.submit(null, { method: "delete" })
                      }
                    >
                      使用全局设置
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </saveFetcher.Form>
      </CardContent>
    </Card>
  )
}
