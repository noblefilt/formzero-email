import assert from "node:assert/strict"
import test from "node:test"

import { buildSubmissionNotificationMessage } from "./email.server"

test("submission notification email behaves like a direct replyable message", () => {
  const message = buildSubmissionNotificationMessage(
    {
      notification_email: "inbox@example.com",
      notification_email_password: "secret",
      smtp_host: "smtp.example.com",
      smtp_port: 465,
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
      },
    }
  )

  assert.equal(message.to, "inbox@example.com")
  assert.equal(message.replyTo, "ada@example.com")
  assert.equal(message.from, "Ada Lovelace <inbox@example.com>")
  assert.match(message.subject, /Ada Lovelace/)
  assert.match(message.text, /Can you send details?/)
  assert.match(message.text, /Budget: \$500/)
  assert.doesNotMatch(message.text, /FormZero|提交 ID|来源|接收时间/)
  assert.doesNotMatch(message.html, /FormZero|提交 ID|来源|接收时间/)
})
