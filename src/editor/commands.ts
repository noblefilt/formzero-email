export const editorCommands = [
  "load_template",
  "set_subject",
  "set_preview_text",
  "select_block",
  "append_block",
  "update_block",
  "remove_block",
  "undo",
  "redo",
  "set_preview_mode",
  "set_feedback",
  "set_autosave",
  "set_drag_preview",
  "set_drop_placeholder",
  "set_export_html",
  "hydrate_document",
] as const

export type EditorCommand = (typeof editorCommands)[number]
