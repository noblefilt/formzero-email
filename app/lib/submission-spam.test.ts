import assert from "node:assert/strict"
import test from "node:test"

import {
  cleanSubmissionData,
  getSourceDomain,
  getSubmissionEmail,
  getSubmissionMessage,
  isSpamSubmission,
} from "./submission-spam"

test("honeypot values mark submissions as spam but empty honeypots do not", () => {
  assert.equal(isSpamSubmission({ _gotcha: "bot-filled" }), true)
  assert.equal(isSpamSubmission({ _gotcha: "   " }), false)
  assert.equal(isSpamSubmission({ email: "reader@example.com" }), false)
})

test("cleanSubmissionData removes control fields before storage and email", () => {
  assert.deepEqual(
    cleanSubmissionData({
      email: "reader@example.com",
      message: "Hello",
      _gotcha: "bot-filled",
      _redirect: "https://example.com/thanks",
    }),
    {
      email: "reader@example.com",
      message: "Hello",
    }
  )
})

test("spam preview helpers extract the mailbox, message, and source domain", () => {
  const submission = {
    Email: "reader@example.com",
    Message: "I need help with my order.",
  }

  assert.equal(getSubmissionEmail(submission), "reader@example.com")
  assert.equal(getSubmissionMessage(submission), "I need help with my order.")
  assert.equal(getSourceDomain("https://shop.example.com/contact"), "shop.example.com")
  assert.equal(getSourceDomain(null), "Direct submission")
})
