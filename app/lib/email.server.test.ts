import assert from "node:assert/strict"
import test from "node:test"

import {
  buildSubmissionNotificationMessage,
  buildTestEmailMessage,
} from "./email.server"

test("test email uses the configured public identity and notification inbox", () => {
  const message = buildTestEmailMessage({
    notification_email: "smtp@example.com",
    notification_email_password: "secret",
    smtp_host: "smtp.example.com",
    smtp_port: 465,
    public_site_name: "Canada Fishing Licence",
    from_name: "Canada Fishing Licence",
    from_email: "contact@canadafishinglicence.com",
    notification_to_email: "operator@example.com",
  })

  assert.equal(message.to, "operator@example.com")
  assert.equal(message.from, "Canada Fishing Licence <contact@canadafishinglicence.com>")
  assert.equal(message.subject, "Canada Fishing Licence email settings test")
  assert.doesNotMatch(message.subject, /[\u4e00-\u9fff]/)
  assert.doesNotMatch(message.text, /[\u4e00-\u9fff]/)
  assert.doesNotMatch(message.html, /[\u4e00-\u9fff]/)
})

test("test email keeps legacy SMTP settings compatible", () => {
  const message = buildTestEmailMessage({
    notification_email: "smtp@example.com",
    notification_email_password: "secret",
    smtp_host: "smtp.example.com",
    smtp_port: 465,
  })

  assert.equal(message.to, "smtp@example.com")
  assert.equal(message.from, "FormZero <smtp@example.com>")
  assert.equal(message.subject, "FormZero email settings test")
})

test("submission notification email behaves like a direct replyable message", () => {
  const message = buildSubmissionNotificationMessage(
    {
      notification_email: "inbox@example.com",
      notification_email_password: "secret",
      smtp_host: "smtp.example.com",
      smtp_port: 465,
      public_site_name: "Canada Fishing Licence",
      from_email: "contact@canadafishinglicence.com",
      from_name: "Canada Fishing Licence",
      notification_to_email: "operator@example.com",
    },
    {
      id: "sub-1",
      formId: "contact",
      formName: "Contact",
      createdAt: 123,
      data: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        message: "Can you send details?",
        budget: "$500",
        source: "modal",
        page_url: "https://example.com/contact",
      },
    }
  )

  assert.equal(message.to, "operator@example.com")
  assert.equal(message.replyTo, "ada@example.com")
  assert.equal(message.from, "Ada Lovelace <contact@canadafishinglicence.com>")
  assert.equal(message.subject, "Canada Fishing Licence inquiry from Ada Lovelace")
  assert.doesNotMatch(message.subject, /[\u4e00-\u9fff]/)
  assert.doesNotMatch(message.subject, /FormZero|submission|提交/)
  assert.match(message.text, /Can you send details?/)
  assert.doesNotMatch(message.text, /Budget|Source|Page Url|page_url|modal|https:\/\/example\.com\/contact/)
  assert.doesNotMatch(message.html, /Budget|Source|Page Url|page_url|modal|https:\/\/example\.com\/contact/)
  assert.doesNotMatch(message.text, /FormZero|提交 ID|来源|接收时间/)
  assert.doesNotMatch(message.html, /FormZero|提交 ID|来源|接收时间/)
  assert.doesNotMatch(message.html, /background-color:\s*#f7f7f7|max-width:\s*640px|border-radius:\s*12px/)
})

test("submission notification keeps legacy SMTP settings compatible", () => {
  const message = buildSubmissionNotificationMessage(
    {
      notification_email: "legacy-inbox@example.com",
      notification_email_password: "secret",
      smtp_host: "smtp.example.com",
      smtp_port: 465,
    },
    {
      id: "sub-2",
      formId: "contact",
      formName: "Contact",
      createdAt: 123,
      data: {
        email: "reader@example.com",
        message: "I need help.",
      },
    }
  )

  assert.equal(message.to, "legacy-inbox@example.com")
  assert.equal(message.from, "reader@example.com <legacy-inbox@example.com>")
  assert.equal(message.replyTo, "reader@example.com")
  assert.equal(message.subject, "New inquiry from reader@example.com")
})

test("submission notification sanitizes customer-visible email identity", () => {
  const message = buildSubmissionNotificationMessage(
    {
      notification_email: "fallback@example.com",
      notification_email_password: "secret",
      smtp_host: "smtp.example.com",
      smtp_port: 465,
      public_site_name: 'Canada\nFishing <Licence>',
      from_email: "contact@example.com",
      notification_to_email: "owner@example.com",
    },
    {
      id: "sub-3",
      formId: "contact",
      formName: "Contact",
      createdAt: 123,
      data: {
        name: 'Abe "The Angler" <Pettyjohn>',
        email: "abe@example.com",
        message: "Question about my licence.",
      },
    }
  )

  assert.equal(
    message.subject,
    "Canada Fishing Licence inquiry from Abe The Angler Pettyjohn"
  )
  assert.equal(message.from, "Abe The Angler Pettyjohn <contact@example.com>")
})
