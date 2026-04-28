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
import { blockRegistry, getBlockDefinition } from "../blocks/registry"
import type { EmailBlock, EmailBlockType } from "../blocks/types"
import { PreviewPane } from "../preview/preview-pane"
import type { EditorBootstrapData, TemplateStatus } from "../templates/types"
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
import type { UxAutosaveState } from "../ui/ux-standards"
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

function getBlockLabel(type: EmailBlockType) {
  return getBlockDefinition(type).label
}

function formatAutosaveState(state: UxAutosaveState) {
  if (state === "saving") return "保存中"
  if (state === "saved") return "已保存"
  if (state === "error") return "保存失败"
  return "待保存"
}

function formatTemplateStatus(status: TemplateStatus) {
  return status === "starter" ? "内置" : "草稿"
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
          <div className="text-sm font-semibold">{getBlockLabel(block.type)}</div>
          {issues.length > 0 ? (
            <div className="rounded-full border border-destructive/20 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
              {issues.length} 个问题
            </div>
          ) : null}
        </div>
        <div className="text-muted-foreground text-sm leading-6">
          {block.type === "text" ? block.content : null}
          {block.type === "image" ? block.caption || block.alt : null}
          {block.type === "button" ? `${block.label} -> ${block.href}` : null}
          {block.type === "divider" ? `${block.tone} 分割线` : null}
          {block.type === "spacer" ? `${block.size}px 间距` : null}
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
      return "导出检查已通过。"
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
              onClick={() => createTemplate(`未命名草稿 ${templates.length + 1}`)}
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
              个人邮件模板
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              只保留写邮件需要的编辑、预览和导出。
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              当前用户：{userName}。界面显示中文，导出的 HTML、区块 type
              和存储字段继续保持英文。
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip
                label={storageReady ? "已连接云端存储" : "仅本地临时模式"}
                state={storageReady ? "success" : "error"}
              />
              <StatusChip
                label={state.lastMessage}
                state={state.feedbackState}
                data-ux-feedback={state.feedbackState}
              />
              <StatusChip
                label={`自动保存：${formatAutosaveState(state.autosaveState)}`}
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
                撤销
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={state.history.future.length === 0}
              >
                <Redo2 />
                重做
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-ux-cancel=""
                onClick={cancelAutosave}
              >
                取消保存
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-ux-retry=""
                onClick={retryAutosave}
              >
                重试
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
                导出 HTML
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (!window.confirm("确定删除当前模板和已保存草稿吗？")) {
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
              历史记录支持 {MIN_UNDO_HISTORY_STEPS} 步。
            </span>
          </div>
        </section>

        {storageMessage ? (
          <Panel className="gap-3 border-dashed border-amber-500/30 bg-amber-500/10">
            <PanelHeader>
              <div>
                <PanelTitle>存储状态</PanelTitle>
                <PanelDescription>{storageMessage}</PanelDescription>
              </div>
            </PanelHeader>
            <div className="text-sm text-muted-foreground">
              自动保存仍会运行。编辑器数据表就绪前，版本记录和跨设备同步会暂时关闭。
            </div>
          </Panel>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
          <aside className="space-y-4">
            <Panel className="gap-4">
              <PanelHeader>
                <div>
                  <PanelTitle>模板</PanelTitle>
                  <PanelDescription>
                    选择一个草稿或内置模板。
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
                          {formatTemplateStatus(template.status)}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        更新于 {formatTimestamp(template.updatedAt)}
                      </div>
                    </button>
                  )
                })}
              </div>
            </Panel>

            <Panel className="gap-4">
              <PanelHeader>
                <div>
                  <PanelTitle>内容区块</PanelTitle>
                  <PanelDescription>
                    中文是显示名称，实际区块类型仍是英文。
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
                        添加
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
                  <PanelTitle>邮件信息</PanelTitle>
                  <PanelDescription>
                    主题、预览文字会实时校验并参与导出。
                  </PanelDescription>
                </div>
              </PanelHeader>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">邮件主题</span>
                  <Input
                    value={state.history.present.subject}
                    onChange={(event) => setSubject(event.target.value)}
                    data-ux-autosave-input=""
                    placeholder="填写收件箱里看到的主题"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">预览文字</span>
                  <Input
                    value={state.history.present.previewText}
                    onChange={(event) => setPreviewText(event.target.value)}
                    placeholder="填写主题旁边显示的一句话"
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
                  <PanelTitle>正文画布</PanelTitle>
                  <PanelDescription>
                    点击区块后，在右侧编辑具体内容。
                  </PanelDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={state.previewMode === "desktop" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewMode("desktop")}
                  >
                    桌面
                  </Button>
                  <Button
                    type="button"
                    variant={state.previewMode === "mobile" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewMode("mobile")}
                  >
                    手机
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
                          放到这里：
                          {state.dragPreviewType ? getBlockLabel(state.dragPreviewType) : "区块"}
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
                      放到末尾：
                      {state.dragPreviewType ? getBlockLabel(state.dragPreviewType) : "区块"}
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
                  <PanelTitle>版本</PanelTitle>
                  <PanelDescription>
                    大改前保存一个可恢复的版本。
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
                              恢复
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
                        <EmptyTitle>还没有保存版本</EmptyTitle>
                        <EmptyDescription>
                          还没有保存版本，大改前可以先保存一次。
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
                    <EmptyTitle>版本功能暂不可用</EmptyTitle>
                    <EmptyDescription>
                      编辑器数据表就绪后，才能使用版本保存和恢复。
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </Panel>

            <Panel className="gap-4">
              <PanelHeader>
                <div>
                  <PanelTitle>编辑区块</PanelTitle>
                  <PanelDescription>
                    这里只显示当前选中区块的设置。
                  </PanelDescription>
                </div>
              </PanelHeader>

              {selectedBlock ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-background p-3">
                    <div className="text-sm font-semibold">
                      {getBlockLabel(selectedBlock.type)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {blockIssues[selectedBlock.id]?.[0] ?? "没有阻塞问题。"}
                    </div>
                  </div>

                  {selectedBlock.type === "text" ? (
                    <label className="space-y-2">
                      <span className="text-sm font-medium">正文</span>
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
                        <span className="text-sm font-medium">按钮文字</span>
                        <Input
                          value={selectedBlock.label}
                          onChange={(event) =>
                            updateBlock(selectedBlock.id, { label: event.target.value })
                          }
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium">链接 URL</span>
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
                        <span className="text-sm font-medium">图片 URL</span>
                        <Input
                          value={selectedBlock.src}
                          onChange={(event) =>
                            updateBlock(selectedBlock.id, { src: event.target.value })
                          }
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Alt 文本</span>
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
                      <span className="text-sm font-medium">HTML 片段</span>
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
                      <span className="text-sm font-medium">样式</span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={selectedBlock.tone === "subtle" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateBlock(selectedBlock.id, { tone: "subtle" })}
                        >
                          轻
                        </Button>
                        <Button
                          type="button"
                          variant={selectedBlock.tone === "strong" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateBlock(selectedBlock.id, { tone: "strong" })}
                        >
                          强
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {selectedBlock.type === "spacer" ? (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">高度</span>
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
                    删除区块
                  </Button>
                </div>
              ) : (
                <Empty className="border border-dashed bg-muted/30" data-ux-empty-state="">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MailPlus />
                    </EmptyMedia>
                    <EmptyTitle>请选择一个区块</EmptyTitle>
                    <EmptyDescription>
                      在正文画布中点击任一区块后，这里会显示可编辑字段。
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      type="button"
                      variant="outline"
                      data-ux-empty-cta=""
                      onClick={() => appendBlock("text")}
                    >
                      添加文本区块
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
            </Panel>

          </aside>
        </div>
      </div>
    </main>
  )
}
