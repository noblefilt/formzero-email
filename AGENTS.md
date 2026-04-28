# AGENTS

## Purpose

This repository is a private FormZero form-submission inbox for personal use.
It should receive messages reliably, send clean replyable notifications, and
keep a simple authenticated backend for reviewing normal and spam submissions.

The source of truth for product scope is
[`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md). If code and spec diverge,
update the spec in the same task or stop and resolve the conflict before
continuing.

## Product Standard

Personal-use quality means:

- fast enough to trust,
- predictable enough to use daily,
- recoverable enough to survive mistakes,
- simple enough not to fight the operator.

This project does **not** optimize for SEO, multitenancy, RBAC, approval trees,
or an email-template editor. It **does** optimize for clean notifications,
submission intake, spam handling, and maintainable inbox workflows.

## Core Principles

- Every user action must show immediate feedback: loading, success, or error.
- All interactive form validation must happen before submit where practical.
- Every empty state must include guidance, next steps, or a primary CTA.
- Async operations that can fail should expose retry or a clear corrective step.
- Data loss is unacceptable. Destructive actions need confirmation.
- Notification emails should be clean, direct, and replyable.
- Tracking metadata such as source and page URL should not be displayed as user
  message content.

## Engineering Rules

- Keep changes minimal and directly tied to the requested workflow.
- Do not add speculative features or abstractions.
- Keep submission intake, notification rendering, spam detection, and inbox
  display rules isolated and testable.
- Add or update tests for P0 paths touched by a change.
- If a module-level behavior changes, update the corresponding doc in the same
  change.
- Do not leave placeholder TODO comments in committed code.

## Module Navigation

- `app/routes/api.forms.$formId.submissions.tsx` -> submission intake API.
- `app/routes/forms.$formId.submissions.tsx` -> normal inbox and actions.
- `app/routes/forms.spam.tsx` -> spam quarantine review.
- `app/lib/email.server.ts` -> SMTP test and submission notification emails.
- `app/lib/submission-spam.ts` -> spam classification and submission parsing.
- `app/lib/submission-display.ts` -> visible field filtering and labels.
- `app/components/ui/` -> design system components.

## UX Guardrails

- No blocking spinners without context.
- No disabled primary action without explaining why.
- No destructive action without confirmation.
- No blank table, panel, or page without a clear next action.
- No generic “Something went wrong” unless followed by a concrete recovery path.

## Testing Expectations

- Intake changes require API/action tests or focused regression coverage.
- Email changes require message-rendering tests.
- Spam changes require classification and inbox-action coverage.
- Display filtering changes require tests for hidden metadata fields.
- Route changes require route-contract coverage.

## Forbidden

- Do not reintroduce the email-template editor.
- Do not add SEO/sitemap publishing for this private tool.
- Do not show `source`, `page_url`, UTM fields, honeypot fields, or redirects as
  user message content in emails, table columns, detail panels, or CSV export.
- Do not hide recoverable failures behind logs alone.
