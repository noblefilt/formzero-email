import { validateBlock } from "../blocks/registry"
import type { EmailBlock } from "../blocks/types"
import { MIN_UNDO_HISTORY_STEPS } from "../ui/ux-standards"
import type { EmailDocument } from "../templates/types"
import type { EditorAction, EditorState, EditorValidationState } from "./types"

function cloneDocument(document: EmailDocument): EmailDocument {
  return {
    ...document,
    blocks: document.blocks.map((block) => ({ ...block })),
  }
}

function validateDocument(document: EmailDocument): EditorValidationState {
  const blocks: Record<string, string[]> = {}
  const documentIssues: string[] = []

  if (!document.subject.trim()) {
    documentIssues.push("导出前需要填写邮件主题。")
  }

  if (!document.previewText.trim()) {
    documentIssues.push("预览文字为空，请补一句收件箱摘要。")
  }

  document.blocks.forEach((block) => {
    const issues = validateBlock(block).map((item) => item.message)

    if (issues.length > 0) {
      blocks[block.id] = issues
    }
  })

  return {
    document: documentIssues,
    blocks,
  }
}

function pushHistory(state: EditorState, nextDocument: EmailDocument): EditorState {
  const present = cloneDocument(state.history.present)
  const nextPresent = cloneDocument(nextDocument)
  const past = [...state.history.past, present].slice(-MIN_UNDO_HISTORY_STEPS)

  return {
    ...state,
    activeTemplate: {
      ...state.activeTemplate,
      updatedAt: nextPresent.updatedAt,
      document: nextPresent,
    },
    history: {
      ...state.history,
      past,
      future: [],
      present: nextPresent,
      capacity: MIN_UNDO_HISTORY_STEPS,
    },
    validation: validateDocument(nextPresent),
  }
}

function patchDocument(
  state: EditorState,
  update: (document: EmailDocument) => EmailDocument
) {
  const nextDocument = update(cloneDocument(state.history.present))
  nextDocument.updatedAt = new Date().toISOString()
  return pushHistory(state, nextDocument)
}

export function createInitialEditorState(template: EditorState["activeTemplate"]): EditorState {
  const present = cloneDocument(template.document)

  return {
    activeTemplate: {
      ...template,
      document: present,
    },
    history: {
      past: [],
      present,
      future: [],
      capacity: MIN_UNDO_HISTORY_STEPS,
    },
    selectedBlockId: present.blocks[0]?.id ?? null,
    previewMode: "desktop",
    feedbackState: "idle",
    autosaveState: "idle",
    validation: validateDocument(present),
    dragPreviewType: null,
    dropPlaceholderIndex: null,
    lastExportHtml: "",
    lastMessage: "工作区已就绪。",
  }
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === "load_template") {
    return createInitialEditorState(action.template)
  }

  if (action.type === "set_subject") {
    return patchDocument(state, (document) => ({
      ...document,
      subject: action.value,
    }))
  }

  if (action.type === "set_preview_text") {
    return patchDocument(state, (document) => ({
      ...document,
      previewText: action.value,
    }))
  }

  if (action.type === "select_block") {
    return {
      ...state,
      selectedBlockId: action.blockId,
    }
  }

  if (action.type === "append_block") {
    return patchDocument(state, (document) => {
      const blocks = [...document.blocks]
      const index = action.index ?? blocks.length
      blocks.splice(index, 0, action.block)

      return {
        ...document,
        blocks,
      }
    })
  }

  if (action.type === "update_block") {
    return patchDocument(state, (document) => ({
      ...document,
      blocks: document.blocks.map((block) =>
        block.id === action.blockId
          ? ({ ...block, ...action.patch } as EmailBlock)
          : block
      ),
    }))
  }

  if (action.type === "remove_block") {
    return patchDocument(state, (document) => ({
      ...document,
      blocks: document.blocks.filter((block) => block.id !== action.blockId),
    }))
  }

  if (action.type === "undo") {
    const previous = state.history.past[state.history.past.length - 1]
    if (!previous) return state

    const present = cloneDocument(state.history.present)
    const past = state.history.past.slice(0, -1)

    return {
      ...state,
      history: {
        ...state.history,
        past,
        future: [present, ...state.history.future].slice(0, MIN_UNDO_HISTORY_STEPS),
        present: cloneDocument(previous),
      },
      activeTemplate: {
        ...state.activeTemplate,
        document: cloneDocument(previous),
      },
      validation: validateDocument(previous),
      selectedBlockId: previous.blocks[0]?.id ?? null,
    }
  }

  if (action.type === "redo") {
    const next = state.history.future[0]
    if (!next) return state

    const present = cloneDocument(state.history.present)

    return {
      ...state,
      history: {
        ...state.history,
        past: [...state.history.past, present].slice(-MIN_UNDO_HISTORY_STEPS),
        future: state.history.future.slice(1),
        present: cloneDocument(next),
      },
      activeTemplate: {
        ...state.activeTemplate,
        document: cloneDocument(next),
      },
      validation: validateDocument(next),
      selectedBlockId: next.blocks[0]?.id ?? null,
    }
  }

  if (action.type === "set_preview_mode") {
    return {
      ...state,
      previewMode: action.mode,
    }
  }

  if (action.type === "set_feedback") {
    return {
      ...state,
      feedbackState: action.state,
      lastMessage: action.message,
    }
  }

  if (action.type === "set_autosave") {
    return {
      ...state,
      autosaveState: action.state,
      lastMessage: action.message,
    }
  }

  if (action.type === "set_drag_preview") {
    return {
      ...state,
      dragPreviewType: action.blockType,
    }
  }

  if (action.type === "set_drop_placeholder") {
    return {
      ...state,
      dropPlaceholderIndex: action.index,
    }
  }

  if (action.type === "set_export_html") {
    return {
      ...state,
      lastExportHtml: action.html,
    }
  }

  if (action.type === "hydrate_document") {
    return createInitialEditorState({
      ...state.activeTemplate,
      updatedAt: action.document.updatedAt,
      document: action.document,
    })
  }

  return state
}
