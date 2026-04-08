import { useState, useEffect } from "react"
import { useFetcher } from "react-router"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card"
import { Input } from "#/components/ui/input"
import { Label } from "#/components/ui/label"
import { ResultButton } from "#/components/result-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip"
import { Mail, Lock, Server } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog"
import type { Settings } from "#/types/settings"

// SMTP configurations for common email providers
const SMTP_CONFIGS: Record<string, { host: string; port: number; secure: boolean; hint: string }> = {
  "gmail.com": {
    host: "smtp.gmail.com",
    port: 587,
    secure: true,
    hint: "Gmail 请使用应用专用密码。前往 Google 账户 → 安全性 → 两步验证 → 应用专用密码。"
  },
  "outlook.com": {
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: true,
    hint: "Outlook 请使用 Microsoft 账户密码，如已开启两步验证请使用应用专用密码。"
  },
  "hotmail.com": {
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: true,
    hint: "Hotmail 请使用 Microsoft 账户密码，如已开启两步验证请使用应用专用密码。"
  },
  "yahoo.com": {
    host: "smtp.mail.yahoo.com",
    port: 587,
    secure: true,
    hint: "Yahoo 请生成应用专用密码：账户信息 → 账户安全 → 生成应用密码。"
  },
  "icloud.com": {
    host: "smtp.mail.me.com",
    port: 587,
    secure: true,
    hint: "iCloud 请使用 App 专用密码。前往 appleid.apple.com → 登录和安全 → App 专用密码。"
  },
}

function getEmailDomain(email: string): string | null {
  const match = email.match(/@(.+)$/)
  return match ? match[1].toLowerCase() : null
}

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings | null
}

export function SettingsDialog({ open, onOpenChange, settings }: SettingsDialogProps) {
  const fetcher = useFetcher()
  const testFetcher = useFetcher()
  const clearFetcher = useFetcher()

  // Initialize with user's email if settings don't exist yet
  const [email, setEmail] = useState(settings?.notification_email || "")
  const [password, setPassword] = useState(settings?.notification_email_password || "")
  const [smtpHost, setSmtpHost] = useState(settings?.smtp_host || "")
  const [smtpPort, setSmtpPort] = useState(settings?.smtp_port?.toString() || "")

  // Initialize emailDomain and smtpConfig from settings on mount
  const initialEmail = settings?.notification_email || ""
  const initialDomain = getEmailDomain(initialEmail)
  const initialConfig = initialDomain && SMTP_CONFIGS[initialDomain] ? SMTP_CONFIGS[initialDomain] : null

  const [emailDomain, setEmailDomain] = useState<string | null>(initialDomain)
  const [smtpConfig, setSmtpConfig] = useState<typeof SMTP_CONFIGS[string] | null>(initialConfig)
  const [testPassed, setTestPassed] = useState(false)
  const [testResultValid, setTestResultValid] = useState(true)

  // Update form when settings prop changes
  useEffect(() => {
    if (settings) {
      setEmail(settings.notification_email || "")
      setPassword(settings.notification_email_password || "")
      setSmtpHost(settings.smtp_host || "")
      setSmtpPort(settings.smtp_port?.toString() || "")
    }
  }, [settings])

  // Auto-detect SMTP settings based on email (debounced)
  useEffect(() => {
    const domain = getEmailDomain(email)

    if (!domain) {
      setEmailDomain(null)
      setSmtpConfig(null)
      return
    }

    const timer = setTimeout(() => {
      setEmailDomain(domain)

      if (SMTP_CONFIGS[domain]) {
        const config = SMTP_CONFIGS[domain]
        setSmtpConfig(config)
        setSmtpHost(config.host)
        setSmtpPort(config.port.toString())
      } else {
        setSmtpConfig(null)
        if (!settings?.smtp_host) {
          setSmtpHost("")
          setSmtpPort("")
        }
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [email, settings?.smtp_host])

  const isSaving = fetcher.state === "submitting"
  const isSaved = fetcher.state === "idle" && fetcher.data?.success

  const isTesting = testFetcher.state === "submitting"
  const testSuccess = testFetcher.state === "idle" && testFetcher.data?.success && testResultValid

  const isClearing = clearFetcher.state === "submitting"
  const isCleared = clearFetcher.state === "idle" && clearFetcher.data?.success

  useEffect(() => {
    if (testSuccess) {
      setTestPassed(true)
    }
  }, [testSuccess])

  useEffect(() => {
    setTestPassed(false)
    setTestResultValid(false)
  }, [email, password, smtpHost, smtpPort])

  useEffect(() => {
    if (clearFetcher.state === "idle" && clearFetcher.data?.success) {
      setEmail("")
      setPassword("")
      setSmtpHost("")
      setSmtpPort("")
      setEmailDomain(null)
      setSmtpConfig(null)
      setTestPassed(false)
      setTestResultValid(false)
    }
  }, [clearFetcher.state, clearFetcher.data])

  const handleTestEmail = () => {
    setTestResultValid(true)

    const formData = new FormData()
    formData.append("notification_email", email)
    formData.append("notification_email_password", password)
    formData.append("smtp_host", smtpHost)
    formData.append("smtp_port", smtpPort)

    testFetcher.submit(formData, {
      method: "post",
      action: "/settings/notifications/test"
    })
  }

  const handleDisableNotifications = () => {
    clearFetcher.submit(null, {
      method: "delete",
      action: "/settings/notifications"
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] h-[90vh] max-w-[90vw] sm:max-w-[90vw] max-h-[90vh] overflow-y-auto p-6 flex flex-col items-start">
        <DialogHeader className="mb-6 w-full">
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>邮件通知</CardTitle>
            <CardDescription>
              配置所有表单提交的邮件通知
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <fetcher.Form method="post" action="/settings/notifications">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    您的邮箱
                  </Label>
                  <Input
                    id="email"
                    name="notification_email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    此邮箱将用于发送和接收通知
                  </p>
                </div>

                {emailDomain && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        SMTP 密码
                      </Label>
                      <Input
                        id="password"
                        name="notification_email_password"
                        type="password"
                        placeholder="请输入 SMTP 密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <p className="text-sm text-muted-foreground">
                        {smtpConfig ? smtpConfig.hint : "使用您的邮箱密码或应用专用密码"}
                      </p>
                    </div>

                    {!smtpConfig && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="smtp-host" className="flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            SMTP 主机
                          </Label>
                          <Input
                            id="smtp-host"
                            name="smtp_host"
                            type="text"
                            placeholder="smtp.example.com"
                            value={smtpHost}
                            onChange={(e) => setSmtpHost(e.target.value)}
                            required
                          />
                          <p className="text-sm text-muted-foreground">
                            您邮箱服务商的 SMTP 服务器地址
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="smtp-port">SMTP 端口</Label>
                          <Input
                            id="smtp-port"
                            name="smtp_port"
                            type="number"
                            placeholder="587"
                            value={smtpPort}
                            onChange={(e) => setSmtpPort(e.target.value)}
                            required
                          />
                          <p className="text-sm text-muted-foreground">
                            常用端口：587 (TLS)、465 (SSL)、25 (明文)
                          </p>
                        </div>
                      </div>
                    )}

                    {smtpConfig && (
                      <>
                        <input type="hidden" name="smtp_host" value={smtpHost} />
                        <input type="hidden" name="smtp_port" value={smtpPort} />
                      </>
                    )}

                    <div className="pt-4 space-y-3">
                      {testFetcher.data?.error && testResultValid && (
                        <p className="text-sm text-destructive">
                          {testFetcher.data.error}
                        </p>
                      )}
                      <TooltipProvider>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <ResultButton
                              type="button"
                              variant="outline"
                              isSubmitting={isTesting}
                              isSuccess={testSuccess}
                              loadingText="发送中..."
                              successText="测试邮件已发送！"
                              disabled={!email || !password || !smtpHost || !smtpPort}
                              onClick={handleTestEmail}
                              className="w-full sm:w-auto"
                            >
                              发送测试邮件
                            </ResultButton>
                            <Tooltip open={!testPassed ? undefined : false}>
                              <TooltipTrigger asChild>
                                <span className="w-full sm:w-auto">
                                  <ResultButton
                                    type="submit"
                                    isSubmitting={isSaving}
                                    isSuccess={isSaved}
                                    loadingText="保存中..."
                                    successText="已保存！"
                                    disabled={!testPassed}
                                    className="w-full sm:w-auto"
                                  >
                                    保存设置
                                  </ResultButton>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>请先发送测试邮件验证设置</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          {settings && (
                            <ResultButton
                              type="button"
                              variant="outline"
                              isSubmitting={isClearing}
                              isSuccess={isCleared}
                              loadingText="禁用中..."
                              successText="已禁用！"
                              className="w-full sm:w-auto text-destructive hover:text-destructive"
                              onClick={handleDisableNotifications}
                            >
                              禁用通知
                            </ResultButton>
                          )}
                        </div>
                      </TooltipProvider>
                    </div>
                  </>
                )}
              </div>
            </fetcher.Form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}
