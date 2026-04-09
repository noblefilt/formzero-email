# AGENTS

## Purpose

This repository is evolving from FormZero into a professional email template
editor for personal use. The benchmark is commercial-grade reliability and UX,
not team features, multitenancy, or RBAC.

The source of truth for product scope is
[`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md).
If code and spec diverge, update the spec in the same task or stop and resolve
the conflict before continuing.

## Product Standard

Personal-use enterprise quality means:

- fast enough to trust,
- predictable enough to work daily,
- recoverable enough to survive mistakes,
- modular enough to extend without rewriting the core.

This project does **not** optimize for multitenancy, RBAC, or approval trees.
It **does** optimize for editor quality, export correctness, recovery, and
maintainable architecture.

## Core Principles

- Every user action must show immediate feedback:
  `loading`, `success`, or `error`.
- All form validation must be real-time; never wait until submit to reveal basic
  field errors.
- Every empty state must include guidance, next steps, or a primary CTA.
  Blank pages are defects.
- Every async operation must support cancel or retry. Silent waiting is not
  acceptable.
- Preview and exported output must stay visually aligned. Fidelity bugs are
  product bugs, not polish issues.
- Data loss is unacceptable. Autosave, undo/redo, and recovery are core
  features, not enhancements.

## Engineering Rules

- Model the editor around a versioned document schema, not ad hoc component
  state.
- Keep export logic isolated from UI. HTML generation must be testable without
  rendering the app.
- Route editing mutations through explicit commands or transactions so undo/redo
  remains possible.
- Prefer strict typing across document schema, block props, export input, and
  persistence boundaries.
- Add or update tests for every P0 path you touch.
- If a module-level behavior changes, update its corresponding doc in the same
  change.
- If a referenced module doc does not exist yet, create it before making that
  module harder to understand.

## Definition Of Done

A change is not done until all of the following are true:

- The UI exposes clear loading, success, and error feedback for the affected
  action.
- Validation happens during input, not only on submit.
- Empty, loading, error, and success states are all intentionally designed.
- Async flows can be canceled or retried where failure or delay is realistic.
- The happy path works end-to-end.
- Failure paths are handled in human language with a corrective next step.
- Tests cover the changed behavior at the right level.
- Docs stay in sync with the code.

## Module Navigation

- `src/editor/` -> Drag-and-drop editor core. See `docs/editor.md`
- `src/blocks/` -> All draggable content blocks. See `docs/blocks.md`
- `src/export/` -> HTML/image/PDF export pipeline. See `docs/export.md`
- `src/templates/` -> Template library and template management. See `docs/templates.md`
- `src/preview/` -> Multi-device preview: desktop, mobile, dark mode
- `src/ui/` -> Design system components. All UI must be imported from here

## Module Expectations

### `src/editor/`

- Owns canvas state, selection state, drag behavior, command dispatch, undo/redo,
  autosave triggers, and crash recovery hooks.
- Must feel immediate. Selection, hover, drag targets, and insertion indicators
  should never feel ambiguous.
- Never couple document editing logic directly to view-only components.

### `src/blocks/`

- Every block must declare a typed schema, editable props, defaults, preview
  behavior, and export behavior.
- Blocks are reusable primitives, not one-off page fragments.
- New blocks must ship with meaningful empty and invalid states where relevant.

### `src/export/`

- Must produce deterministic output from document input.
- Export failures must surface actionable errors in the UI.
- Never hide partial export failures behind console logs.

### `src/templates/`

- Owns template CRUD, duplication, archival, restore, metadata, and starter
  templates.
- Template operations must always provide optimistic or explicit progress
  feedback.
- Destructive actions must confirm intent and support recovery.

### `src/preview/`

- Must reflect actual export behavior as closely as possible.
- Device switching must be instant and never discard editor state.
- Visual mismatch between preview and export is a release blocker for affected
  features.

### `src/ui/`

- Central source for design system components and feedback patterns.
- Do not scatter custom button, dialog, input, or toast variants across feature
  folders.
- UI primitives must make good states easy to implement and bad states hard to
  ship.

## UX Guardrails

- No blocking spinners without context.
- No disabled primary action without explaining why.
- No destructive action without either undo or explicit confirmation.
- No background save without visible saved/saving/error state.
- No "empty" table, panel, or canvas without a clear next action.
- No generic "Something went wrong" message unless followed by a concrete
  recovery path.

## Testing Expectations

- Document model changes require schema and migration coverage.
- Export changes require fixture or snapshot coverage.
- Editor interaction changes require behavior tests for selection, drag, delete,
  undo, and redo when applicable.
- Async UI changes require tests for loading, success, error, and retry states.
- Bugs that reached the UI should gain a regression test whenever practical.

## Forbidden

- Do not merge incomplete features to the main branch.
- Do not add backend operations without complete UI feedback states.
- Do not leave `TODO: later`, `TODO: future`, or equivalent placeholder comments
  in committed code.
- Do not ship submit-only validation for interactive forms.
- Do not ship blank empty states.
- Do not hide recoverable failures behind logs alone.

## Decision Filter

When choosing between two implementations, prefer the one that improves:

1. export correctness,
2. editor responsiveness,
3. recovery from mistakes,
4. clarity of user feedback,
5. long-term extensibility of the document model.
