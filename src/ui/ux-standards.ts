export const UX_GRID_UNIT_PX = 4 as const

export const UX_MOTION_MS = {
  micro: 150,
  page: 300,
} as const

export const UX_FEEDBACK_STATES = [
  "idle",
  "loading",
  "success",
  "error",
] as const

export const UX_AUTOSAVE_STATES = [
  "idle",
  "saving",
  "saved",
  "error",
] as const

export const UX_FEATURE_LIFECYCLE = [
  "create",
  "edit",
  "preview",
  "export",
  "delete",
] as const

export const MIN_UNDO_HISTORY_STEPS = 50 as const

export const UX_ATTRS = {
  action: "data-ux-action",
  feedback: "data-ux-feedback",
  validation: "data-ux-validation",
  autosaveStatus: "data-ux-autosave-status",
  dragSource: "data-ux-drag-source",
  dropPlaceholder: "data-ux-drop-placeholder",
  emptyState: "data-ux-empty-state",
  emptyCta: "data-ux-empty-cta",
  cancel: "data-ux-cancel",
  retry: "data-ux-retry",
  historyCapacity: "data-ux-history-capacity",
  lifecycle: "data-ux-lifecycle",
} as const

export type UxFeedbackState = (typeof UX_FEEDBACK_STATES)[number]
export type UxAutosaveState = (typeof UX_AUTOSAVE_STATES)[number]
export type FeatureLifecycleStage = (typeof UX_FEATURE_LIFECYCLE)[number]

export type UxAsyncContract = {
  state: UxFeedbackState
  retry: (() => Promise<void> | void) | null
  cancel: (() => void) | null
}

export type UxHistoryContract = {
  capacity: number
  undo: () => void
  redo: () => void
}

export type UxFeatureLifecycle = Record<FeatureLifecycleStage, boolean>

export function assertUndoHistoryCapacity(capacity: number): void {
  if (capacity < MIN_UNDO_HISTORY_STEPS) {
    throw new Error(
      `Undo history must retain at least ${MIN_UNDO_HISTORY_STEPS} steps. Received ${capacity}.`
    )
  }
}

export function assertFeatureLifecycle(
  lifecycle: Partial<UxFeatureLifecycle>
): void {
  const missing = UX_FEATURE_LIFECYCLE.filter((stage) => !lifecycle[stage])

  if (missing.length > 0) {
    throw new Error(
      `Feature lifecycle is incomplete. Missing: ${missing.join(", ")}.`
    )
  }
}
