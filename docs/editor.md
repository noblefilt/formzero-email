# editor

## Purpose

`src/editor/` owns the interactive editing experience for the email template
editor. It is the orchestration layer between:

- the document model,
- block definitions,
- preview state,
- export state,
- autosave,
- undo/redo history,
- user feedback states.

The editor is not a page-level collection of uncontrolled components. It is a
stateful application surface with strict behavioral contracts.

## Ownership

`src/editor/` is responsible for:

- editor document state and selection state
- command dispatch for mutations
- history management with at least 50 undo steps
- autosave triggering and status exposure
- drag-and-drop orchestration
- live validation summaries
- export and preview handoff
- editor-specific UX hooks defined in `docs/UX_STANDARDS.md`

`src/editor/` is not responsible for:

- block schema definitions
- HTML rendering internals
- template persistence APIs
- low-level design system primitives

## Folder Contract

The first-pass editor module should converge on this structure:

```text
src/editor/
  commands.ts
  default-document.ts
  editor-shell.tsx
  reducer.ts
  types.ts
  use-editor.ts
```

Additional files may be added when the module grows, but command handling,
state ownership, and document typing must remain explicit.

## Core State Model

The editor must operate on a versioned JSON document with:

- document metadata
- subject and preview text
- ordered block tree
- selected block id
- dirty state
- validation state
- autosave state
- export feedback state
- undo/redo history

## Command Rules

All user mutations must flow through explicit commands.

Examples:

- `rename_document`
- `set_subject`
- `set_preview_text`
- `select_block`
- `append_block`
- `update_block_content`
- `update_block_style`
- `remove_block`
- `reorder_block`

Direct deep mutation of nested state inside components is forbidden.

## Autosave Contract

- Autosave is the default save mechanism.
- Saving must surface `idle`, `saving`, `saved`, or `error`.
- Autosave must not block editing.
- Failed autosave must expose retry and preserve unsaved changes.
- Leaving the page with unsaved changes must trigger a guard or recovery path.

## Drag And Drop Contract

- The drag source must remain visually stable.
- The canvas must render a real-time drop placeholder.
- Reordering must be deterministic.
- Drag feedback must never rely only on cursor position without an insertion cue.

## Validation Contract

- Validation must be live.
- The editor must expose both field-level and summary-level validation.
- Invalid export conditions must be visible before the user clicks export.

## Performance Guardrails

- Selection changes must feel immediate.
- Inspector updates must not re-render the whole canvas when unnecessary.
- Dragging must avoid layout thrash and page jump.
- Expensive export or preview work should be isolated from keystroke paths.

## Definition Of Done

Editor work is complete only when:

- commands are typed,
- undo/redo works,
- autosave works,
- validation is live,
- drag placeholder is visible,
- user actions expose loading/success/error feedback,
- preview and export receive the same normalized document shape.
