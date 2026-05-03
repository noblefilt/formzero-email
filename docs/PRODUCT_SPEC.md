# Product Spec

## Product Direction

FormZero is a private form-submission inbox for one operator. It receives form
submissions from the user's own sites, sends clean replyable email notifications,
and keeps a searchable backend inbox for review, archive, deletion, and spam
triage.

The benchmark is simplicity and reliability, not SEO, team workflows, or an
email-template editor. The product should stay small enough to trust daily.

## Primary User

The primary user is a single site operator who needs to receive contact-form and
lead-form messages from multiple websites without running a public CRM.

## Core Jobs

1. Receive submissions from configured forms.
2. Send a clean email notification that can be replied to directly in Gmail.
3. Keep submitted data in the authenticated FormZero backend.
4. Mark submissions as read, starred, archived, deleted, or spam.
5. Keep automatically detected spam out of the normal inbox.
6. Review spam in one dedicated Spam view.
7. Keep crawler and sitemap behavior disabled because this is a private tool.

## Product Scope

### In Scope

- Private authenticated dashboard.
- Form submission API.
- Form integration instructions.
- Notification settings and test email.
- Replyable submission notification emails.
- Normal submissions inbox with read, star, archive, delete, and one-click manual spam actions.
- Spam quarantine for manually marked spam and older stored spam rows.
- Spam list showing time, email, message, and source domain.
- Route-level resilience for utility URLs and unknown requests.
- Private-tool crawler policy: `noindex`, blocked robots, and no published sitemap.

### Out Of Scope

- SEO features.
- Public sitemap generation.
- Email-template editor.
- Template marketplace features.
- Multitenancy.
- RBAC.
- Approval workflows.
- Billing.
- Speculative backend operations without visible UI feedback.

## Information Architecture

### Public And Utility Routes

- `/login` signs the operator into the workspace.
- `/signup` creates the first local operator account.
- `/success` and `/error` support form-submission redirects.
- `/robots.txt` blocks all crawlers.
- `/sitemap.xml` is intentionally disabled for this private tool.
- Unknown URLs return an intentional 404 response.

### Authenticated Workspace Routes

- `/forms/dashboard` shows the private submission overview.
- `/forms/spam` shows quarantined spam submissions with time, email, message,
  source domain, and a restore action.
- `/forms/:formId/submissions` shows the normal inbox for a form and supports
  read, star, archive, delete, and manual spam marking.
- `/forms/:formId/integration` keeps form integration setup available.
- `/settings/notifications` controls notification settings.

## Notification Contract

Submission notification emails must behave like direct messages:

- `Reply-To` points to the submitter email when available.
- The visible email body shows only the submitter name, email, and message.
- Source metadata such as `source`, `page_url`, UTM fields, redirects, and
  honeypot fields must not appear in the email body.
- Notification HTML must stay plain and undecorated: no gray page background,
  decorative card shell, footer metadata table, or FormZero branding block.
- Spam submissions do not send email notifications.

## Inbox Contract

The normal submissions inbox must show user-facing form fields and hide tracking
metadata from table columns, detail panels, and CSV export.

Required actions:

- mark read / unread,
- star / unstar,
- archive / unarchive,
- mark as spam from the row icon immediately after the star icon,
- delete with confirmation.

Marking a normal submission as spam moves it out of the normal inbox by setting
`is_spam = 1`. This action does not ask for confirmation; the row should leave
the active queue immediately, and mistaken clicks are recovered from the Spam
view.

## Spam Contract

Spam can enter the system in two ways:

- automatically when the built-in honeypot field is filled or the message is
  obviously low-information random text,
- manually when the operator marks a normal submission as spam.

Automatically detected spam submissions are accepted with the normal success
response or redirect, but they are not written to D1 and do not trigger email or
webhook side effects. Manual spam rows and older stored spam rows remain visible
in the Spam page.

The Spam page should stay intentionally small: time, email, message, source
domain, a one-click restore button that sets `is_spam = 0`, and a confirmed
delete action that permanently removes the spam row.

## Engineering Standard

Implementation should remain simple and modular.

Preferred ownership:

- `app/routes/api.forms.$formId.submissions.tsx` owns submission intake.
- `app/routes/forms.$formId.submissions.tsx` owns normal inbox actions.
- `app/routes/forms.spam.tsx` owns spam review.
- `app/lib/email.server.ts` owns notification email rendering and delivery.
- `app/lib/submission-spam.ts` owns spam classification and submission parsing helpers.
- `app/lib/submission-display.ts` owns which submitted fields are shown to the operator.

When code and this spec diverge, update the spec in the same change or stop and
resolve the conflict.

## Release Gates

A release-quality change should pass:

1. `npm run test:routes`
2. `npm run lint:ux`
3. `npm run typecheck`
4. `npm run test:unit`
5. `npm run build`

If one of these cannot be run locally, report the reason with the closest
completed verification.
