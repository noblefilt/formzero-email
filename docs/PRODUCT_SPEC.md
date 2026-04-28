# Product Spec

## Product Direction

FormZero is being narrowed into a personal-use, professional email template
editor backed by the existing Cloudflare Workers and D1 application shell.

The benchmark is commercial-grade reliability for one operator, not team
collaboration. The product should feel trustworthy enough for daily email
template work: fast editing, predictable preview, deterministic export, clear
recovery, and safe persistence.

## Primary User

The primary user is a single site operator who needs to create, edit, preview,
version, and export reusable email templates without managing a separate email
design tool.

The product may still support the original form-submission workflow where it is
already implemented, but new architecture should optimize for the email editor
surface first.

## Core Jobs

1. Create a new email template from a blank or starter template.
2. Edit subject, preview text, and ordered content blocks with immediate
   feedback.
3. Preview the same document shape that export will render.
4. Export deterministic HTML suitable for email delivery.
5. Autosave edits without relying on a manual save loop.
6. Save and restore named versions of a template.
7. Recover from failed persistence or export without data loss.
8. Delete templates intentionally, with confirmation or recovery.

## Product Scope

### In Scope

- A versioned email document schema.
- Typed reusable email blocks.
- Editor commands for every mutation.
- Undo and redo with at least 50 history steps.
- Autosave with visible `idle`, `saving`, `saved`, and `error` states.
- Retry or cancel controls for realistic async failure paths.
- Template persistence in D1.
- Starter templates and blank-template creation.
- Version snapshots, restore, and deletion.
- Multi-mode preview for desktop, mobile, and dark mode.
- Deterministic HTML export isolated from the React UI.
- Route-level resilience for public utility URLs and unknown requests.
- Private-tool crawler policy: the app must advertise `noindex`, block all
  robots, and avoid publishing a sitemap.
- Existing form submissions may be quarantined as Spam when the built-in
  honeypot is filled.

### Out Of Scope

- Multitenancy.
- RBAC.
- Approval workflows.
- Team comments.
- Billing.
- Public template marketplace features.
- Speculative backend operations that do not have complete UI feedback states.

## Information Architecture

### Public And Utility Routes

- `/login` signs an existing operator into the workspace.
- `/signup` creates the first and only local operator account.
- `/success` and `/error` support form-submission redirects.
- `/robots.txt` blocks all crawlers.
- `/sitemap.xml` is intentionally disabled for this private tool.
- Unknown URLs must return an intentional 404 response instead of surfacing as
  unmatched-route runtime errors.

### Authenticated Workspace Routes

- `/forms/dashboard` keeps the existing submission overview available.
- `/forms/spam` shows automatically quarantined spam submissions with only
  time, email, message, and source domain.
- `/forms/:formId/submissions` keeps existing submission inspection available.
- `/forms/:formId/integration` keeps existing form integration setup available.
- `/editor` is the email template editor and must be reachable from the
  authenticated workspace navigation.
- `/settings/notifications` controls notification settings.

## Editor Contract

The editor must be modeled around a versioned document, not scattered component
state. Components may display and collect input, but they must not own document
mutation rules.

Every mutation should flow through explicit commands or transactions so history,
autosave, validation, preview, and export observe the same state transition.

Required behaviors:

- Selection feedback is immediate.
- Block insertion and drag movement show visible placement feedback.
- Validation is live and visible before export.
- Export is disabled when blocking validation issues exist.
- Autosave failures preserve unsaved edits and expose retry.
- Version restore creates a new recoverable snapshot instead of overwriting
  history silently.

## Export Contract

Export is a product trust boundary. The preview and exported HTML must be based
on the same normalized document input.

Required behaviors:

- HTML generation is deterministic for the same document.
- Export logic is testable without rendering the app.
- Export failures surface human-readable recovery guidance in the UI.
- Partial export failures must not be hidden behind console output.

## Persistence Contract

D1 persistence must be explicit and recoverable.

Required behaviors:

- The editor can enter a local fallback mode when editor tables are missing.
- The UI must clearly label local-only fallback mode.
- Server persistence failures must keep the current draft in memory.
- Retrying persistence must reuse the latest unsaved document.
- Deleted templates must not be listed as active templates.

## UX Standard

All editor-facing work must comply with `docs/UX_STANDARDS.md`.

The most important rules are:

- Every user action exposes immediate feedback.
- Validation appears during input.
- Empty states include guidance and a next action.
- Async operations expose retry or cancel where delay or failure is realistic.
- No destructive action ships without confirmation or recovery.
- Blank pages are defects.

## Engineering Standard

Implementation should remain simple and modular.

Preferred architecture:

- `src/editor/` owns editor state, command dispatch, history, autosave, and
  validation.
- `src/blocks/` owns block schemas, defaults, validation, preview behavior, and
  export behavior.
- `src/export/` owns deterministic HTML rendering and download behavior.
- `src/templates/` owns template records, starter templates, and version data.
- `src/preview/` owns visual preview surfaces.
- `src/ui/` owns shared primitives and feedback patterns.

When code and this spec diverge, the same change must either update the spec or
stop and resolve the conflict.

## Release Gates

A release-quality change must pass:

1. `npm run test:routes`
2. `npm run lint:ux`
3. `npm run typecheck`
4. `npm run test:ux`
5. `npm run build`

If one of these cannot be run in the local environment, the reason must be
reported with the closest completed verification.
