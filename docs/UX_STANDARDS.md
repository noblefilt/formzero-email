# UX_STANDARDS

**Priority**: Highest
**Applies to**: Entire email template editor surface
**Supersedes**: Local component preferences, temporary delivery shortcuts, and
"we will polish later" tradeoffs

This document is the highest-priority product constraint for the email template
editor. If implementation pressure conflicts with these standards, the feature
scope must shrink before the standards do.

The source product intent is
[`docs/PRODUCT_SPEC.md`](./PRODUCT_SPEC.md). This document defines the non-
negotiable UX execution rules.

## 1. Interaction Response Standards

### Immediate Feedback

- Clicking any actionable control must produce visible feedback in **0-16ms**.
- The feedback may be a pressed state, loading state, optimistic state, or
  disabled-in-progress state.
- Waiting for a network round trip before showing feedback is a defect.

### Drag And Drop

- Every drag operation must show a real-time placeholder or insertion marker.
- Dragging must not cause the page or canvas to jump unexpectedly.
- Drop targets must remain visually legible while dragging.
- A user must always know where the block will land before release.

### Saving

- Saving is automatic.
- Users must not be required to click a manual "Save" button for normal editing.
- Autosave must expose visible status: `idle`, `saving`, `saved`, or `error`.
- Autosave failures must offer retry and must never silently discard edits.

## 2. Error Handling Standards

Every error path must implement all three layers below.

### 2.1 Prevention

- Disable or guard unavailable operations before the user can trigger them.
- Perform real-time validation while the user types, selects, drags, or uploads.
- Prevent invalid transitions instead of allowing them and apologizing later.

### 2.2 Recovery

- Undo and redo are mandatory.
- Operation history must support at least **50 steps**.
- Destructive operations must provide confirmation, undo, or both.
- Async failures must provide **retry**, **cancel**, or both, depending on the
  operation.

### 2.3 Explanation

- Every error message must say:
  - what happened
  - why it matters when relevant
  - how to fix it
- "Something went wrong" alone is never acceptable.
- Error copy must be human-readable and specific to the action that failed.

## 3. Visual Consistency Standards

- All spacing must come from a **4px grid system**.
- Colors must come from **design tokens only**.
- Hardcoded hex colors are prohibited in application code.
- Micro-interaction duration is always **150ms**.
- Page transition duration is always **300ms**.
- There are no exceptions to the animation timings above.

## 4. Functional Completeness Standards

Every product feature must implement the full lifecycle below:

`Create -> Edit -> Preview -> Export -> Delete`

Additional rules:

- Delete must include explicit confirmation.
- A feature missing any lifecycle stage is **not complete**.
- Preview must be meaningfully close to exported output, not a decorative mock.
- Export errors are part of the feature, not a separate technical concern.

## 5. Required Test Hooks

To make these standards automatically verifiable, interactive surfaces must
expose stable `data-*` hooks.

| Contract | Required hook |
| --- | --- |
| Action trigger | `data-ux-action` |
| Action feedback state | `data-ux-feedback="idle|loading|success|error"` |
| Live validation message | `data-ux-validation` |
| Autosave status | `data-ux-autosave-status="idle|saving|saved|error"` |
| Drag source | `data-ux-drag-source` |
| Drop placeholder | `data-ux-drop-placeholder` |
| Empty state container | `data-ux-empty-state` |
| Empty state CTA | `data-ux-empty-cta` |
| Cancel control | `data-ux-cancel` |
| Retry control | `data-ux-retry` |
| Undo history capacity | `data-ux-history-capacity` |
| Feature lifecycle root | `data-ux-lifecycle` |

These hooks are product infrastructure, not test-only clutter.

## 6. Automation Strategy

### ESLint

Static linting must reject:

- hardcoded hex colors
- invalid motion durations
- arbitrary spacing values that break the 4px grid
- `TODO` comments and similar deferred-quality markers

### TypeScript

TypeScript contracts must define:

- allowed feedback states
- autosave states
- minimum undo history
- required feature lifecycle stages
- design-token-backed motion and spacing constants

### Playwright

Runtime tests must verify:

- button feedback appears within 16ms
- drag operations render a placeholder without canvas jump
- autosave works without a manual save button
- validation appears before submit
- undo history capacity is at least 50
- async flows expose cancel or retry affordances
- empty states include guidance and CTA

## 7. CI Enforcement

CI must run the following checks:

1. `npm run lint:ux`
2. `npm run typecheck`
3. `npm run test:ux`

If a feature cannot pass these checks, it is not ready for the main branch.

## 8. Release Blocking Failures

The following issues block release by default:

- no immediate visual feedback on click
- no live validation on user-editable forms
- no placeholder during drag
- missing autosave status
- missing retry/cancel path for async failure
- manual-save-only editing flow
- hardcoded hex colors in app code
- motion duration outside 150ms or 300ms
- lifecycle missing preview or export
- any blank empty state
