import { useState, useEffect } from "react"
import { useParams, useLoaderData, useFetcher } from "react-router"
import type { Route } from "./+types/forms.$formId.integration"
import { data } from "react-router"
import { Copy, Check, Mail, Lock, Server } from "lucide-react"
import { Highlight, themes } from "prism-react-renderer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { requireAuth } from "~/lib/require-auth.server"

const SMTP_CONFIGS: Record<string, { host: string; port: number; hint: string }> = {
  "gmail.com": { host: "smtp.gmail.com", port: 587, hint: "Gmail 请使用应用专用密码（Google 账户 → 安全性 → 应用专用密码）。" },
  "outlook.com": { host: "smtp-mail.outlook.com", port: 587, hint: "Outlook 请使用 Microsoft 账户密码或应用专用密码。" },
  "hotmail.com": { host: "smtp-mail.outlook.com", port: 587, hint: "Hotmail 请使用 Microsoft 账户密码或应用专用密码。" },
  "yahoo.com": { host: "smtp.mail.yahoo.com", port: 587, hint: "Yahoo 请在账户安全设置中生成应用专用密码。" },
  "icloud.com": { host: "smtp.mail.me.com", port: 587, hint: "iCloud 请使用 appleid.apple.com 的 App 专用密码。" },
}

function getEmailDomain(email: string): string | null {
  const match = email.match(/@(.+)$/)
  return match ? match[1].toLowerCase() : null
}

export const meta: Route.MetaFunction = () => {
  return [
    { title: "集成 | FormZero" },
    { name: "description", content: "使用 HTML、JavaScript 或 React 集成您的表单" },
  ];
};

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const database = context.cloudflare.env.DB
  await requireAuth(request, database)

  const formEmail = await database
    .prepare("SELECT notification_email, notification_email_password, smtp_host, smtp_port FROM forms WHERE id = ?")
    .bind(params.formId)
    .first<{
      notification_email: string | null
      notification_email_password: string | null
      smtp_host: string | null
      smtp_port: number | null
    }>()

  return {
    formEmail: formEmail && formEmail.notification_email ? {
      notification_email: formEmail.notification_email,
      notification_email_password: formEmail.notification_email_password || "",
      smtp_host: formEmail.smtp_host || "",
      smtp_port: formEmail.smtp_port || 587,
    } : null,
  }
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const database = context.cloudflare.env.DB
  await requireAuth(request, database)

  if (request.method === "DELETE") {
    await database
      .prepare("UPDATE forms SET notification_email = NULL, notification_email_password = NULL, smtp_host = NULL, smtp_port = NULL WHERE id = ?")
      .bind(params.formId)
      .run()
    return data({ success: true })
  }

  const formData = await request.formData()
  const notification_email = formData.get("notification_email") as string
  const notification_email_password = formData.get("notification_email_password") as string
  const smtp_host = formData.get("smtp_host") as string
  const smtp_port = formData.get("smtp_port") as string

  if (!notification_email || !notification_email_password || !smtp_host || !smtp_port) {
    return data({ success: false, error: "所有字段均为必填" }, { status: 400 })
  }

  await database
    .prepare("UPDATE forms SET notification_email = ?, notification_email_password = ?, smtp_host = ?, smtp_port = ? WHERE id = ?")
    .bind(notification_email, notification_email_password, smtp_host, parseInt(smtp_port, 10), params.formId)
    .run()

  return data({ success: true })
}

export default function IntegrationPage() {
  const params = useParams()
  const formId = params.formId
  const { formEmail } = useLoaderData<typeof loader>()
  const [copiedEndpoint, setCopiedEndpoint] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  // Use browser location to construct endpoint
  const formEndpoint = typeof window !== "undefined"
    ? `${window.location.origin}/api/forms/${formId}/submissions`
    : `/api/forms/${formId}/submissions`

  const handleCopyEndpoint = async () => {
    await navigator.clipboard.writeText(formEndpoint)
    setCopiedEndpoint(true)
    setTimeout(() => setCopiedEndpoint(false), 2000)
  }

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const htmlExample = `<form action="${formEndpoint}" method="POST">
  <input type="text" name="name" placeholder="Your Name" required />
  <input type="email" name="email" placeholder="Your Email" required />
  <textarea name="message" placeholder="Your Message"></textarea>

  <!-- 反垃圾邮件：honeypot 隐藏字段，机器人会填写此字段导致提交被静默拒绝 -->
  <input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off" />

  <!-- 可选：提交后重定向 -->
  <input type="hidden" name="_redirect" value="https://yoursite.com/thanks" />

  <button type="submit">Submit</button>
</form>`

  const jsExample = `fetch('${formEndpoint}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    message: 'Hello!'
  })
})
  .then(response => response.json())
  .then(data => console.log('Success:', data))
  .catch(error => console.error('Error:', error))`

  const reactExample = `import { useState } from 'react'

function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [status, setStatus] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('sending')

    try {
      const response = await fetch('${formEndpoint}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setStatus('success')
        setFormData({ name: '', email: '', message: '' })
      } else {
        setStatus('error')
      }
    } catch (error) {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Your Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <input
        type="email"
        placeholder="Your Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
      />
      <textarea
        placeholder="Your Message"
        value={formData.message}
        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
      />
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending...' : 'Submit'}
      </button>
      {status === 'success' && <p>Message sent successfully!</p>}
      {status === 'error' && <p>Error sending message. Please try again.</p>}
    </form>
  )
}`

  return (
    <div className="flex flex-1 flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle>接口地址</CardTitle>
          <CardDescription>
            将此地址用作 HTML 表单的 <code className="rounded bg-muted px-1 py-0.5 text-xs">action</code> URL，或直接发送 JSON 数据。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono break-all">
              {formEndpoint}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyEndpoint}
              className="shrink-0 w-full sm:w-auto sm:px-3"
            >
              {copiedEndpoint ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span className="sm:hidden ml-2">已复制！</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="sm:hidden ml-2">复制地址</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>集成示例</CardTitle>
          <CardDescription>
            选择您喜欢的方式向表单提交数据。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="html" className="w-full">
            <TabsList>
              <TabsTrigger value="html">HTML</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="react">React</TabsTrigger>
            </TabsList>

            <TabsContent value="html" className="mt-3">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyCode(htmlExample)}
                  className="absolute top-2 right-2 z-10 h-7 px-2 text-xs"
                >
                  {copiedCode ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Highlight
                  theme={themes.vsDark}
                  code={htmlExample}
                  language="markup"
                >
                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                      className={className}
                      style={{
                        ...style,
                        margin: 0,
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        padding: "0.75rem",
                        overflowX: "auto",
                      }}
                    >
                      {tokens.map((line, i) => (
                        <div key={i} {...getLineProps({ line })}>
                          {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token })} />
                          ))}
                        </div>
                      ))}
                    </pre>
                  )}
                </Highlight>
              </div>
            </TabsContent>

            <TabsContent value="javascript" className="mt-3">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyCode(jsExample)}
                  className="absolute top-2 right-2 z-10 h-7 px-2 text-xs"
                >
                  {copiedCode ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Highlight
                  theme={themes.vsDark}
                  code={jsExample}
                  language="javascript"
                >
                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                      className={className}
                      style={{
                        ...style,
                        margin: 0,
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        padding: "0.75rem",
                        overflowX: "auto",
                      }}
                    >
                      {tokens.map((line, i) => (
                        <div key={i} {...getLineProps({ line })}>
                          {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token })} />
                          ))}
                        </div>
                      ))}
                    </pre>
                  )}
                </Highlight>
              </div>
            </TabsContent>

            <TabsContent value="react" className="mt-3">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyCode(reactExample)}
                  className="absolute top-2 right-2 z-10 h-7 px-2 text-xs"
                >
                  {copiedCode ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Highlight
                  theme={themes.vsDark}
                  code={reactExample}
                  language="jsx"
                >
                  {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                      className={className}
                      style={{
                        ...style,
                        margin: 0,
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        padding: "0.75rem",
                        overflowX: "auto",
                      }}
                    >
                      {tokens.map((line, i) => (
                        <div key={i} {...getLineProps({ line })}>
                          {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token })} />
                          ))}
                        </div>
                      ))}
                    </pre>
                  )}
                </Highlight>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>提交后跳转</CardTitle>
          <CardDescription>
            控制用户提交表单后的跳转目标。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-muted p-3">
              <p className="font-medium mb-1">方式一：隐藏字段</p>
              <code className="text-xs">{'<input type="hidden" name="_redirect" value="https://yoursite.com/thanks" />'}</code>
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="font-medium mb-1">方式二：查询参数</p>
              <code className="text-xs break-all">{formEndpoint}?redirect=https://yoursite.com/thanks</code>
            </div>
            <p className="text-muted-foreground">
              如未指定跳转地址，用户将看到默认的提交成功页面，并带有“返回”按钮。
            </p>
          </div>
        </CardContent>
      </Card>

      <FormEmailSettings formEmail={formEmail} />
    </div>
  )
}

function FormEmailSettings({ formEmail }: { formEmail: { notification_email: string; notification_email_password: string; smtp_host: string; smtp_port: number } | null }) {
  const saveFetcher = useFetcher<{ success?: boolean; error?: string }>()
  const clearFetcher = useFetcher()
  const testFetcher = useFetcher<{ success?: boolean; error?: string }>()

  const [email, setEmail] = useState(formEmail?.notification_email || "")
  const [password, setPassword] = useState(formEmail?.notification_email_password || "")
  const [smtpHost, setSmtpHost] = useState(formEmail?.smtp_host || "")
  const [smtpPort, setSmtpPort] = useState(formEmail?.smtp_port?.toString() || "")
  const [testPassed, setTestPassed] = useState(!!formEmail)

  const domain = getEmailDomain(email)
  const smtpConfig = domain ? SMTP_CONFIGS[domain] || null : null

  useEffect(() => {
    if (smtpConfig) {
      setSmtpHost(smtpConfig.host)
      setSmtpPort(smtpConfig.port.toString())
    }
  }, [smtpConfig?.host])

  useEffect(() => {
    setTestPassed(false)
  }, [email, password, smtpHost, smtpPort])

  const isTesting = testFetcher.state === "submitting"
  const testSuccess = testFetcher.state === "idle" && testFetcher.data?.success

  useEffect(() => {
    if (testSuccess) setTestPassed(true)
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
    const fd = new FormData()
    fd.append("notification_email", email)
    fd.append("notification_email_password", password)
    fd.append("smtp_host", smtpHost)
    fd.append("smtp_port", smtpPort)
    testFetcher.submit(fd, { method: "post", action: "/settings/notifications/test" })
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
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {domain && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="form-password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    SMTP 密码
                  </Label>
                  <Input
                    id="form-password"
                    name="notification_email_password"
                    type="password"
                    placeholder="请输入 SMTP 密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {smtpConfig && (
                    <p className="text-xs text-muted-foreground">{smtpConfig.hint}</p>
                  )}
                </div>

                {!smtpConfig && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="form-smtp-host" className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        SMTP 主机
                      </Label>
                      <Input
                        id="form-smtp-host"
                        name="smtp_host"
                        placeholder="smtp.example.com"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
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
                        onChange={(e) => setSmtpPort(e.target.value)}
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
                  <p className="text-sm text-destructive">{testFetcher.data.error}</p>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!email || !password || !smtpHost || !smtpPort || isTesting}
                    onClick={handleTest}
                  >
                    {isTesting ? "测试中..." : testSuccess ? "测试通过！" : "发送测试邮件"}
                  </Button>
                  <Button
                    type="submit"
                    disabled={!testPassed || isSaving}
                  >
                    {isSaving ? "保存中..." : isSaved ? "已保存！" : "保存"}
                  </Button>
                  {formEmail && (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => clearFetcher.submit(null, { method: "delete" })}
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
