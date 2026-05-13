export type Settings = {
  id: string
  notification_email: string | null
  notification_email_password: string | null
  smtp_host: string | null
  smtp_port: number | null
  smtp_secure: number
  public_site_name: string | null
  from_name: string | null
  from_email: string | null
  notification_to_email: string | null
  updated_at: number
}

export type EmailConfig = {
  notification_email: string
  notification_email_password: string
  smtp_host: string
  smtp_port: number
  public_site_name?: string | null
  from_name?: string | null
  from_email?: string | null
  notification_to_email?: string | null
}
