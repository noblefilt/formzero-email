import { useEffect, useMemo, useReducer, useRef, useState } from "react"

import type { EmailBlock, EmailBlockType } from "../blocks/types"
import { createBlock, getBlockDefinition } from "../blocks/registry"
import { downloadHtml } from "../export/download-html"
import { renderEmailHtml } from "../export/render-email-html"
import type {
  EditorBootstrapData,
  EmailDocument,
  EmailTemplateRecord,
} from "../templates/types"
import {
  assertFeatureLifecycle,
  assertUndoHistoryCapacity,
} from "../ui/ux-standards"
import { blankTemplate } from "./default-document"
import { createInitialEditorState, editorReducer } from "./reducer"

const STORAGE_PREFIX = "formzero-email-editor"

type EditorServerMutation =
  | { intent: "create_template"; name?: string }
  | { intent: "save_template"; templateId: string; document: EmailDocument }
  | { intent: "save_version"; templateId: string; document: EmailDocument }
  | { intent: "restore_version"; templateId: string; versionId: string }
  | { intent: "delete_template"; templateId: string }

type UseEditorOptions = {
  initialBootstrap: EditorBootstrapData
}

function getInitialTemplate(bootstrap: EditorBootstrapData) {
  return bootstrap.templates[0] ?? blankTemplate
}

function getBlockLabel(type: EmailBlockType) {
  return getBlockDefinition(type).label
}

export function useEditor({ initialBootstrap }: UseEditorOptions) {
  const [templates, setTemplates] = useState(initialBootstrap.templates)
  const [versionsByTemplate, setVersionsByTemplate] = useState(
    initialBootstrap.versionsByTemplate
  )
  const [storageReady, setStorageReady] = useState(initialBootstrap.storageReady)
  const [storageMessage, setStorageMessage] = useState(
    initialBootstrap.storageMessage
  )
  const [state, dispatch] = useReducer(
    editorReducer,
    getInitialTemplate(initialBootstrap),
    createInitialEditorState
  )
  const autosaveTimerRef = useRef<number | null>(null)
  const activeRequestRef = useRef<AbortController | null>(null)
  const lastSavedRef = useRef(JSON.stringify(getInitialTemplate(initialBootstrap).document))
  const lastMutationRef = useRef<EditorServerMutation | null>(null)

  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${state.activeTemplate.id}`,
    [state.activeTemplate.id]
  )

  useEffect(() => {
    assertUndoHistoryCapacity(state.history.capacity)
    assertFeatureLifecycle({
      create: true,
      edit: true,
      preview: true,
      export: true,
      delete: true,
    })
  }, [state.history.capacity])

  useEffect(() => {
    if (storageReady) return

    if (typeof window === "undefined") return

    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as EmailDocument
      dispatch({ type: "hydrate_document", document: parsed })
      lastSavedRef.current = raw
    } catch {
      dispatch({
        type: "set_autosave",
        state: "error",
        message:
          "无法恢复本地草稿，已从当前模板开始。",
      })
    }
  }, [storageKey, storageReady])

  async function sendMutation(
    mutation: EditorServerMutation,
    options?: {
      message?: string
      successMessage?: string
      activeTemplateId?: string
      reloadActiveTemplate?: boolean
    }
  ) {
    if (!storageReady) {
      return false
    }

    if (activeRequestRef.current) {
      activeRequestRef.current.abort()
    }

    const controller = new AbortController()
    activeRequestRef.current = controller
    lastMutationRef.current = mutation

    if (options?.message) {
      dispatch({
        type: "set_feedback",
        state: "loading",
        message: options.message,
      })
    }

    try {
      const response = await fetch("/editor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mutation),
        signal: controller.signal,
      })

      const payload = (await response.json()) as {
        ok: boolean
        error?: string
        bootstrap?: EditorBootstrapData
      }

      if (!response.ok || !payload.ok || !payload.bootstrap) {
        throw new Error(payload.error || "编辑器保存请求失败。")
      }

      setTemplates(payload.bootstrap.templates)
      setVersionsByTemplate(payload.bootstrap.versionsByTemplate)
      setStorageReady(payload.bootstrap.storageReady)
      setStorageMessage(payload.bootstrap.storageMessage)

      const nextActiveId =
        options?.activeTemplateId ??
        (mutation.intent === "create_template"
          ? payload.bootstrap.templates[0]?.id
          : state.activeTemplate.id)

      if (options?.reloadActiveTemplate ?? true) {
        const nextActiveTemplate =
          payload.bootstrap.templates.find((template) => template.id === nextActiveId) ??
          payload.bootstrap.templates[0]

        if (nextActiveTemplate) {
          dispatch({ type: "load_template", template: nextActiveTemplate })
          lastSavedRef.current = JSON.stringify(nextActiveTemplate.document)
        }
      }

      if (options?.successMessage) {
        dispatch({
          type: "set_feedback",
          state: "success",
          message: options.successMessage,
        })
      }

      return true
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return false
      }

      const message =
        error instanceof Error
          ? error.message
          : "编辑器保存请求失败。"

      dispatch({
        type: "set_feedback",
        state: "error",
        message,
      })
      dispatch({
        type: "set_autosave",
        state: "error",
        message,
      })
      return false
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null
      }
    }
  }

  useEffect(() => {
    const serialized = JSON.stringify(state.history.present)
    if (serialized === lastSavedRef.current) return

    if (!storageReady) {
      if (typeof window === "undefined") return

      dispatch({
        type: "set_autosave",
        state: "saving",
        message: "正在本地自动保存草稿...",
      })

      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
      }

      autosaveTimerRef.current = window.setTimeout(() => {
        try {
          window.localStorage.setItem(storageKey, serialized)
          lastSavedRef.current = serialized
          dispatch({
            type: "set_autosave",
            state: "saved",
            message: "草稿已保存到本地。",
          })
        } catch {
          dispatch({
            type: "set_autosave",
            state: "error",
            message:
              "本地自动保存失败。请保持此页面打开，或先完成迁移再使用云端存储。",
          })
        }
      }, 300)

      return () => {
        if (autosaveTimerRef.current) {
          window.clearTimeout(autosaveTimerRef.current)
        }
      }
    }

    dispatch({
      type: "set_autosave",
      state: "saving",
      message: "正在自动保存草稿...",
    })

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void sendMutation(
        {
          intent: "save_template",
          templateId: state.activeTemplate.id,
          document: state.history.present,
        },
        {
          activeTemplateId: state.activeTemplate.id,
          reloadActiveTemplate: false,
        }
      ).then((didPersist) => {
        if (didPersist) {
          lastSavedRef.current = JSON.stringify(state.history.present)
          dispatch({
            type: "set_autosave",
            state: "saved",
            message: "草稿已保存到云端。",
          })
        }
      })
    }, 500)

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [state.activeTemplate.id, state.history.present, storageKey, storageReady])

  const selectedBlock = useMemo(() => {
    return (
      state.history.present.blocks.find((block) => block.id === state.selectedBlockId) ??
      null
    )
  }, [state.history.present.blocks, state.selectedBlockId])

  const activeVersions = useMemo(() => {
    return versionsByTemplate[state.activeTemplate.id] ?? []
  }, [state.activeTemplate.id, versionsByTemplate])

  function setSubject(value: string) {
    dispatch({ type: "set_subject", value })
  }

  function setPreviewText(value: string) {
    dispatch({ type: "set_preview_text", value })
  }

  function selectTemplate(template: EmailTemplateRecord) {
    if (activeRequestRef.current) {
      activeRequestRef.current.abort()
    }

    dispatch({
      type: "load_template",
      template: {
        ...template,
        document: {
          ...template.document,
          blocks: template.document.blocks.map((block) => ({ ...block })),
        },
      },
    })

    lastSavedRef.current = JSON.stringify(template.document)
  }

  function selectBlock(blockId: string | null) {
    dispatch({ type: "select_block", blockId })
  }

  function appendBlock(type: EmailBlockType, index?: number) {
    const label = getBlockLabel(type)

    dispatch({
      type: "set_feedback",
      state: "loading",
      message: `正在添加${label}区块...`,
    })

    dispatch({
      type: "append_block",
      block: createBlock(type),
      index,
    })

    dispatch({
      type: "set_feedback",
      state: "success",
      message: `${label}区块已添加。`,
    })
  }

  function updateBlock(blockId: string, patch: Partial<EmailBlock>) {
    dispatch({ type: "update_block", blockId, patch })
  }

  function removeBlock(blockId: string) {
    dispatch({ type: "remove_block", blockId })
    dispatch({
      type: "set_feedback",
      state: "success",
      message: "区块已删除，可撤销。",
    })
  }

  function undo() {
    dispatch({ type: "undo" })
    dispatch({
      type: "set_feedback",
      state: "success",
      message: "已撤销。",
    })
  }

  function redo() {
    dispatch({ type: "redo" })
    dispatch({
      type: "set_feedback",
      state: "success",
      message: "已重做。",
    })
  }

  function setPreviewMode(mode: "desktop" | "mobile") {
    dispatch({ type: "set_preview_mode", mode })
  }

  function startDragPreview(blockType: EmailBlockType) {
    dispatch({ type: "set_drag_preview", blockType })
    dispatch({
      type: "set_drop_placeholder",
      index: state.history.present.blocks.length,
    })
  }

  function setDropPlaceholder(index: number | null) {
    dispatch({ type: "set_drop_placeholder", index })
  }

  function clearDragPreview() {
    dispatch({ type: "set_drag_preview", blockType: null })
    dispatch({ type: "set_drop_placeholder", index: null })
  }

  function exportHtml() {
    dispatch({
      type: "set_feedback",
      state: "loading",
      message: "正在生成导出 HTML...",
    })

    const result = renderEmailHtml(state.history.present)

    dispatch({ type: "set_export_html", html: result.html })

    if (!result.ok) {
      dispatch({
        type: "set_feedback",
        state: "error",
        message:
          result.errors[0]?.message ??
          "存在校验问题，暂时无法导出。",
      })
      return
    }

    downloadHtml(`${state.activeTemplate.name}.html`, result.html)
    dispatch({
      type: "set_feedback",
      state: "success",
      message: "HTML 已导出。",
    })
  }

  function cancelAutosave() {
    if (typeof window !== "undefined" && autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
    }

    if (activeRequestRef.current) {
      activeRequestRef.current.abort()
    }

    dispatch({
      type: "set_autosave",
      state: "idle",
      message: "已取消本轮自动保存。",
    })
  }

  function retryAutosave() {
    if (storageReady && lastMutationRef.current) {
      void sendMutation(lastMutationRef.current, {
        activeTemplateId: state.activeTemplate.id,
        message: "正在重试上一次操作...",
        successMessage: "重试已完成。",
        reloadActiveTemplate: lastMutationRef.current.intent !== "save_template",
      })
      return
    }

    lastSavedRef.current = ""
    dispatch({
      type: "set_autosave",
      state: "saving",
      message: "正在重试自动保存...",
    })
  }

  function createTemplate(name?: string) {
    if (!storageReady) {
      const id = `local-${crypto.randomUUID()}`
      const templateName = name?.trim() || "未命名草稿"
      const template: EmailTemplateRecord = {
        ...blankTemplate,
        id,
        name: templateName,
        summary: "编辑器云端存储可用前，这是一个本地草稿。",
        updatedAt: new Date().toISOString(),
        document: {
          ...blankTemplate.document,
          id,
          name: templateName,
          subject: "",
          previewText: "",
          updatedAt: new Date().toISOString(),
          blocks: blankTemplate.document.blocks.map((block) => ({ ...block })),
        },
      }

      setTemplates((current) => [template, ...current])
      dispatch({
        type: "load_template",
        template,
      })
      lastSavedRef.current = JSON.stringify(template.document)
      dispatch({
        type: "set_feedback",
        state: "success",
        message: "本地模板已创建。完成迁移后可使用版本记录。",
      })
      return
    }

    void sendMutation(
      {
        intent: "create_template",
        name,
      },
      {
        message: "正在创建新模板...",
        successMessage: "新模板已创建。",
        reloadActiveTemplate: true,
      }
    )
  }

  function saveVersion() {
    if (!storageReady) {
      dispatch({
        type: "set_feedback",
        state: "error",
        message: "版本记录需要编辑器云端存储，请先完成迁移。",
      })
      return
    }

    void sendMutation(
      {
        intent: "save_version",
        templateId: state.activeTemplate.id,
        document: state.history.present,
      },
      {
        activeTemplateId: state.activeTemplate.id,
        message: "正在保存版本...",
        successMessage: "版本已保存。",
        reloadActiveTemplate: false,
      }
    )
  }

  function restoreVersion(versionId: string) {
    if (!storageReady) {
      dispatch({
        type: "set_feedback",
        state: "error",
        message: "恢复版本需要编辑器云端存储，请先完成迁移。",
      })
      return
    }

    void sendMutation(
      {
        intent: "restore_version",
        templateId: state.activeTemplate.id,
        versionId,
      },
      {
        activeTemplateId: state.activeTemplate.id,
        message: "正在恢复版本...",
        successMessage: "版本已恢复。",
        reloadActiveTemplate: true,
      }
    )
  }

  function deleteTemplate(templateId: string) {
    if (!storageReady) {
      setTemplates((current) => {
        const remaining = current.filter((template) => template.id !== templateId)
        const nextTemplate = remaining[0] ?? blankTemplate
        dispatch({ type: "load_template", template: nextTemplate })
        lastSavedRef.current = JSON.stringify(nextTemplate.document)
        return remaining.length > 0 ? remaining : [blankTemplate]
      })
      dispatch({
        type: "set_feedback",
        state: "success",
        message: "本地模板已删除。",
      })
      return
    }

    void sendMutation(
      {
        intent: "delete_template",
        templateId,
      },
      {
        message: "正在删除模板...",
        successMessage: "模板已删除。",
        reloadActiveTemplate: true,
      }
    )
  }

  return {
    state,
    templates,
    activeVersions,
    storageReady,
    storageMessage,
    selectedBlock,
    setSubject,
    setPreviewText,
    selectTemplate,
    selectBlock,
    appendBlock,
    updateBlock,
    removeBlock,
    undo,
    redo,
    setPreviewMode,
    exportHtml,
    startDragPreview,
    setDropPlaceholder,
    clearDragPreview,
    cancelAutosave,
    retryAutosave,
    createTemplate,
    saveVersion,
    restoreVersion,
    deleteTemplate,
  }
}
