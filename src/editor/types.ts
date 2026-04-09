import type { EmailBlock, EmailBlockType } from "../blocks/types"
import type { EmailDocument, EmailTemplateRecord } from "../templates/types"
import type { UxAutosaveState, UxFeedbackState } from "../ui/ux-standards"

export type EditorHistory = {
  past: EmailDocument[]
  present: EmailDocument
  future: EmailDocument[]
  capacity: number
}

export type EditorValidationState = {
  document: string[]
  blocks: Record<string, string[]>
}

export type EditorState = {
  activeTemplate: EmailTemplateRecord
  history: EditorHistory
  selectedBlockId: string | null
  previewMode: "desktop" | "mobile"
  feedbackState: UxFeedbackState
  autosaveState: UxAutosaveState
  validation: EditorValidationState
  dragPreviewType: EmailBlockType | null
  dropPlaceholderIndex: number | null
  lastExportHtml: string
  lastMessage: string
}

export type EditorAction =
  | { type: "load_template"; template: EmailTemplateRecord }
  | { type: "set_subject"; value: string }
  | { type: "set_preview_text"; value: string }
  | { type: "select_block"; blockId: string | null }
  | { type: "append_block"; block: EmailBlock; index?: number }
  | {
      type: "update_block"
      blockId: string
      patch: Partial<EmailBlock>
    }
  | { type: "remove_block"; blockId: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "set_preview_mode"; mode: "desktop" | "mobile" }
  | { type: "set_feedback"; state: UxFeedbackState; message: string }
  | { type: "set_autosave"; state: UxAutosaveState; message: string }
  | { type: "set_drag_preview"; blockType: EmailBlockType | null }
  | { type: "set_drop_placeholder"; index: number | null }
  | { type: "set_export_html"; html: string }
  | { type: "hydrate_document"; document: EmailDocument }
