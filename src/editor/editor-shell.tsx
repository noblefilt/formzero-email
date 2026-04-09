import {
  GripVertical,
  History,
  MailPlus,
  Redo2,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react"
import { useMemo } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../app/components/ui/breadcrumb"
import { Separator } from "../../app/components/ui/separator"
import { SidebarTrigger } from "../../app/components/ui/sidebar"
import { blockRegistry } from "../blocks/registry"
import type { EmailBlock, EmailBlockType } from "../blocks/types"
import { PreviewPane } from "../preview/preview-pane"
import type { EditorBootstrapData } from "../templates/types"
import { Panel, PanelDescription, PanelHeader, PanelTitle } from "../ui/panel"
import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
} from "../ui/primitives"
import { StatusChip } from "../ui/status-chip"
import { MIN_UNDO_HISTORY_STEPS } from "../ui/ux-standards"
import { blankTemplate } from "./default-document"
import { useEditor } from "./use-editor"

type EditorShellProps = {
  userName: string
  initialBootstrap: EditorBootstrapData
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function CanvasBlock({
  block,
  isSelected,
  issues,
  onSelect,
}: {
  block: EmailBlock
  isSelected: boolean
  issues: string[]
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-150 ${
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-background hover:border-primary/40 hover:bg-accent/40"
      }`}
    >
      <span className="mt-1 rounded-full border bg-muted/60 p-2 text-muted-foreground">
        <GripVertical className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold capitalize">{block.type}</div>
          {issues.length > 0 ? (
            <div className="rounded-full border border-destructive/20 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
              {issues.length} issue{issues.length > 1 ? "s" : ""}
            </div>
          ) : null}
        </div>
        <div className="text-muted-foreground text-sm leading-6">
          {block.type === "text" ? block.content : null}
          {block.type === "image" ? block.caption || block.alt : null}
          {block.type === "button" ? `${block.label} -> ${block.href}` : null}
          {block.type === "divider" ? `${block.tone} divider` : null}
          {block.type === "spacer" ? `${block.size}px spacer` : null}
          {block.type === "html" ? block.html : null}
        </div>
      </div>
    </button>
  )
}

export function EditorShell({ userName, initialBootstrap }: EditorShellProps) {
  const {
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
  } = useEditor({ initialBootstrap })

  const blockIssues = state.validation.blocks
  const hasBlockingIssues =
    state.validation.document.length > 0 || Object.keys(blockIssues).length > 0
  const canDeleteActiveTemplate =
    storageReady ||
    templates.length > 1 ||
    state.activeTemplate.id !== blankTemplate.id

  const validationSummary = useMemo(() => {
    const issues = [
      ...state.validation.document,
      ...Object.values(state.validation.blocks).flat(),
    ]

    if (issues.length === 0) {
      return "All required export checks currently pass."
    }

    return issues[0]
  }, [state.validation.blocks, state.validation.document])

  return (
    <main
      className="min-h-screen bg-background"
      data-ux-lifecycle="create edit preview export delete"
    >
      <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 transition-[width,height] ease-linear backdrop-blur group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex flex-1 items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">FormZero</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>邮件编辑器</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-ux-action="create-template"
              data-ux-feedback={state.feedbackState}
              onClick={() => createTemplate(`Untitled Draft ${templates.length + 1}`)}
            >
              <MailPlus />
              新建模板
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4">
        <section className="grid gap-4 rounded-3xl border bg-card/70 p-6 shadow-sm backdrop-blur lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-2">
            <div className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Professional Email Editor
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Ship durable email templates without a manual save loop.
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              Signed in as {userName}. The workspace now runs real template
              persistence, autosave, version history, export validation, and
              retryable async states from one route.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip
                label={storageReady ? "Persistent storage active" : "Local fallback only"}
                state={storageReady ? "success" : "error"}
              />
              <StatusChip
                label={state.lastMessage}
                state={state.feedbackState}
                data-ux-feedback={state.feedbackState}
              />
              <StatusChip
                label={`Autosave: ${state.autosaveState}`}
                state={state.autosaveState}
                data-ux-autosave-status={state.autosaveState}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={state.history.past.length === 0}
              >
                <RotateCcw />
                Undo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={state.history.future.length === 0}
              >
                <Redo2 />
                Redo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-ux-cancel=""
                onClick={cancelAutosave}
              >
                Cancel autosave
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-ux-retry=""
                onClick={retryAutosave}
              >
                Retry async action
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-ux-action="save-version"
                data-ux-feedback={state.feedbackState}
                onClick={saveVersion}
                disabled={!storageReady}
              >
                <History />
                保存版本
              </Button>
              <Button
                type="button"
                size="sm"
                data-ux-action="export-html"
                data-ux-feedback={state.feedbackState}
                onClick={exportHtml}
                disabled={hasBlockingIssues}
              >
                <Sparkles />
                Export HTML
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (!window.confirm("Delete the current template and its persisted draft?")) {
                    return
                  }

                  deleteTemplate(state.activeTemplate.id)
                }}
                disabled={!canDeleteActiveTemplate}
              >
                <Trash2 />
                删除模板
              </Button>
            </div>
            <span
              className="sr-only"
              data-ux-history-capacity={String(MIN_UNDO_HISTORY_STEPS)}
            >
              History supports {MIN_UNDO_HISTORY_STEPS} steps.
            </span>
          </div>
        </section>

        {storageMessage ? (
          <Panel className="gap-3 border-dashed border-amber-500/30 bg-amber-500/10">
            <PanelHeader>
              <div>
                <PanelTitle>Storage status</PanelTitle>
                <PanelDescription>{storageMessage}</PanelDescription>
              </div>
            </PanelHeader>
            <div className="text-sm text-muted-foreground">
              Autosave still runs. Version history and cross-device persistence stay
              disabled until the editor tables exist.
            </div>
          </Panel>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
          <aside className="space-y-4">
            <Panel className="gap-4">
              <PanelHeader>
                <div>
                  <PanelTitle>Templates</PanelTitle>
                  <PanelDescription>
                    Switch between durable drafts and starter structures.
                  </PanelDescription>
                </div>
              </PanelHeader>

              <div className="space-y-2">
                {templates.map((template) => {
                  const active = template.id === state.activeTemplate.id
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => selectTemplate(template)}
                      className={`w-full rounded-2xl border p-3 text-left transition-colors duration-150 ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:bg-accent/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {template.name}
                          </div>
                          <div className="mt-1 text-sm leading-6 text-muted-foreground">
                            {template.summary}
                          </div>
                        </div>
                        <div className="rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          {template.status}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        Updated {formatTimestamp(template.updatedAt)}
                      </div>
                    </button>
                  )
                })}
              </div>
            </Panel>

            <Panel className="gap-4">
              <PanelHeader>
                <div>
                  <PanelTitle>Block Library</PanelTitle>
                  <PanelDescription>
                    Drag a block into the canvas or click to append.
                  </PanelDescription>
                </div>
              </PanelHeader>

              <div className="space-y-2">
                {blockRegistry.map((definition) => (
                  <div
                    key={definition.type}
                    draggable
                    data-ux-drag-source={definition.type}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", definition.type)
                      startDragPreview(definition.type)
                    }}
                    onDragEnd={clearDragPreview}
                    className="rounded-2xl border border-border bg-background p-3 transition-colors duration-150 hover:bg-accent/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{definition.label}</div>
                        <div className="text-sm leading-6 text-muted-foreground">
                          {definition.description}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => appendBlock(definition.type)}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </aside>

          <section className="min-w-0 space-y-4">
            <Panel className="gap-4">
              <PanelHeader>
                <div>
                  <PanelTitle>Document metadata</PanelTitle>
                  <PanelDescription>
                    Live validation, autosave, and export all start here.
                  </PanelDescription>
                </div>
              </PanelHeader>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Subject line</span>
                  <Input
                    value={state.history.present.subject}
                    onChange={(event) => setSubject(event.target.value)}
                    data-ux-autosave-input=""
                    placeholder="Draft the inbox subject"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Preview text</span>
                  <Input
                    value={state.history.present.previewText}
                    onChange={(event) => setPreviewText(event.target.value)}
                    placeholder="Add the line that appears next to the subject"
                  />
                </label>
              </div>

              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  state.validation.document.length > 0
                    ? "border-destructive/20 bg-destructive/10 text-destructive"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                }`}
                data-ux-validation=""
              >
                {validationSummary}
              </div>
            </Panel>

            <Panel className="gap-4">
              <PanelHeader>
                <div>
                  <PanelTitle>Canvas</PanelTitle>
                  <PanelDescription>
                    The canvas exposes selection state, drag placeholders, and
                    block-level validation.
                  </PanelDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={state.previewMode === "desktop" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewMode("desktop")}
                  >
                    Desktop
                  </Button>
                  <Button
                    type="button"
                    variant={state.previewMode === "mobile" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewMode("mobile")}
                  >
                    Mobile
                  </Button>
                </div>
              </PanelHeader>

              <div className="space-y-4">
                <div
                  className="space-y-3"
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDropPlaceholder(state.history.present.blocks.length)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const rawType = event.dataTransfer.getData("text/plain")
                    const blockType = (rawType || state.dragPreviewType) as
                      | EmailBlockType
                      | null

                    if (blockType) {
                      appendBlock(blockType)
                    }

                    clearDragPreview()
                  }}
                >
                  {state.history.present.blocks.map((block, index) => (
                    <div key={block.id} className="space-y-3">
                      {state.dropPlaceholderIndex === index ? (
                        <div
                          data-ux-drop-placeholder=""
                          className="rounded-2xl border border-dashed border-primary bg-primary/5 p-4 text-sm font-medium text-primary"
                        >
                          Drop {state.dragPreviewType ?? "block"} here
                        </div>
                      ) : null}
                      <CanvasBlock
                        block={block}
                        isSelected={block.id === state.selectedBlockId}
                        issues={blockIssues[block.id] ?? []}
                        onSelect={() => selectBlock(block.id)}
                      />
                    </div>
                  ))}

                  {state.dropPlaceholderIndex === state.history.present.blocks.length ? (
                    <div
                      data-ux-drop-placeholder=""
                      className="rounded-2xl border border-dashed border-primary bg-primary/5 p-4 text-sm font-medium text-primary"
                    >
                      Drop {state.dragPreviewType ?? "block"} at the end
                    </div>
                  ) : null}
                </div>

                <PreviewPane
                  document={state.history.present}
                  mode={state.previewMode}
                />
              </div>
            </Panel>
          </section>

          <aside className="space-y-4">
            <Panel className="gap-4">
              <PanelHeader>
                <div>
                  <PanelTitle>Version history</PanelTitle>
                  <PanelDescription>
                    Keep durable restore points before bigger content changes.
                  </PanelDescription>
                </div>
              </PanelHeader>

              {storageReady ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={saveVersion}
                    data-ux-action="save-version-panel"
                    data-ux-feedback={state.feedbackState}
                  >
                    <History />
                    保存当前版本
                  </Button>

                  {activeVersions.length > 0 ? (
                    <div className="space-y-2">
                      {activeVersions.map((version) => (
                        <div
                          key={version.id}
                          className="rounded-2xl border bg-background p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">
                                V{version.versionNumber} · {version.templateName}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {formatTimestamp(version.createdAt)}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => restoreVersion(version.id)}
                            >
                              Restore
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty className="border border-dashed bg-muted/30">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <History />
                        </EmptyMedia>
                        <EmptyTitle>No saved versions yet</EmptyTitle>
                        <EmptyDescription>
                          Save the first milestone before deeper structural edits.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </>
              ) : (
                <Empty className="border border-dashed bg-muted/30">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <History />
                    </EmptyMedia>
                    <EmptyTitle>Version history unavailable</EmptyTitle>
                    <EmptyDescription>
                      Run the editor storage migration to unlock persisted snapshots
                      and restore points.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </Panel>

            <Panel className="gap-4">
              <PanelHeader>
                <div>
                  <PanelTitle>Inspector</PanelTitle>
                  <PanelDescription>
                    Edit the selected block without leaving the canvas.
                  </PanelDescription>
                </div>
              </PanelHeader>

              {selectedBlock ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-background p-3">
                    <div className="text-sm font-semibold capitalize">
                      {selectedBlock.type}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {blockIssues[selectedBlock.id]?.[0] ?? "No blocking issues."}
                    </div>
                  </div>

                  {selectedBlock.type === "text" ? (
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Copy</span>
                      <textarea
                        className="min-h-40 w-full rounded-2xl border bg-background px-3 py-3 text-sm outline-none transition-colors duration-150 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                        value={selectedBlock.content}
                        onChange={(event) =>
                          updateBlock(selectedBlock.id, { content: event.target.value })
                        }
                      />
                    </label>
                  ) : null}

                  {selectedBlock.type === "button" ? (
                    <div className="space-y-4">
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Label</span>
                        <Input
                          value={selectedBlock.label}
                          onChange={(event) =>
                            updateBlock(selectedBlock.id, { label: event.target.value })
                          }
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium">URL</span>
                        <Input
                          value={selectedBlock.href}
                          onChange={(event) =>
                            updateBlock(selectedBlock.id, { href: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  ) : null}

                  {selectedBlock.type === "image" ? (
                    <div className="space-y-4">
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Image URL</span>
                        <Input
                          value={selectedBlock.src}
                          onChange={(event) =>
                            updateBlock(selectedBlock.id, { src: event.target.value })
                          }
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Alt text</span>
                        <Input
                          value={selectedBlock.alt}
                          onChange={(event) =>
                            updateBlock(selectedBlock.id, { alt: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  ) : null}

                  {selectedBlock.type === "html" ? (
                    <label className="space-y-2">
                      <span className="text-sm font-medium">HTML snippet</span>
                      <textarea
                        className="min-h-40 w-full rounded-2xl border bg-background px-3 py-3 font-mono text-sm outline-none transition-colors duration-150 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                        value={selectedBlock.html}
                        onChange={(event) =>
                          updateBlock(selectedBlock.id, { html: event.target.value })
                        }
                      />
                    </label>
                  ) : null}

                  {selectedBlock.type === "divider" ? (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Tone</span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={selectedBlock.tone === "subtle" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateBlock(selectedBlock.id, { tone: "subtle" })}
                        >
                          Subtle
                        </Button>
                        <Button
                          type="button"
                          variant={selectedBlock.tone === "strong" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateBlock(selectedBlock.id, { tone: "strong" })}
                        >
                          Strong
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {selectedBlock.type === "spacer" ? (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Size</span>
                      <div className="flex flex-wrap gap-2">
                        {[16, 24, 32, 40].map((size) => (
                          <Button
                            key={size}
                            type="button"
                            variant={selectedBlock.size === size ? "default" : "outline"}
                            size="sm"
                            onClick={() =>
                              updateBlock(selectedBlock.id, {
                                size: size as 16 | 24 | 32 | 40,
                              })
                            }
                          >
                            {size}px
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => removeBlock(selectedBlock.id)}
                  >
                    Remove block
                  </Button>
                </div>
              ) : (
                <Empty className="border border-dashed bg-muted/30">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MailPlus />
                    </EmptyMedia>
                    <EmptyTitle>Select a block</EmptyTitle>
                    <EmptyDescription>
                      The inspector becomes useful after you choose a block in the
                      canvas.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </Panel>

            <Panel className="gap-4">
              <PanelHeader>
                <div>
                  <PanelTitle>Reusable modules</PanelTitle>
                  <PanelDescription>
                    The module library is intentionally empty in this first pass.
                  </PanelDescription>
                </div>
              </PanelHeader>

              <Empty className="border border-dashed bg-muted/30" data-ux-empty-state="">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MailPlus />
                  </EmptyMedia>
                  <EmptyTitle>No reusable modules yet</EmptyTitle>
                  <EmptyDescription>
                    Save a strong hero or CTA block pattern here once module
                    persistence lands.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button type="button" variant="outline" data-ux-empty-cta="">
                    Document the first reusable module
                  </Button>
                </EmptyContent>
              </Empty>
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  )
}
