import type { EmailBlock } from "../blocks/types"
import type { EmailDocument } from "../templates/types"
import { Panel, PanelDescription, PanelHeader, PanelTitle } from "../ui/panel"

type PreviewPaneProps = {
  document: EmailDocument
  mode: "desktop" | "mobile"
}

function PreviewBlock({ block }: { block: EmailBlock }) {
  if (block.type === "text") {
    const alignClass =
      block.align === "center"
        ? "text-center"
        : block.align === "right"
          ? "text-right"
          : "text-left"

    return <p className={`text-base leading-7 text-foreground ${alignClass}`}>{block.content}</p>
  }

  if (block.type === "image") {
    return (
      <figure className="space-y-2">
        <img
          src={block.src}
          alt={block.alt}
          className="w-full rounded-2xl border object-cover"
        />
        {block.caption ? (
          <figcaption className="text-muted-foreground text-sm">
            {block.caption}
          </figcaption>
        ) : null}
      </figure>
    )
  }

  if (block.type === "button") {
    return (
      <div className={`flex ${block.align === "center" ? "justify-center" : block.align === "right" ? "justify-end" : "justify-start"}`}>
        <div className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
          {block.label}
        </div>
      </div>
    )
  }

  if (block.type === "divider") {
    return <div className={block.tone === "strong" ? "border-t" : "border-t border-dashed"} />
  }

  if (block.type === "spacer") {
    return <div style={{ height: block.size }} />
  }

  return (
    <div className="rounded-xl border border-dashed bg-muted/40 p-4 text-sm">
      <div className="font-medium">Custom HTML</div>
      <div className="text-muted-foreground mt-2 font-mono text-xs">
        {block.html}
      </div>
    </div>
  )
}

export function PreviewPane({ document, mode }: PreviewPaneProps) {
  return (
    <Panel className="min-h-full gap-4">
      <PanelHeader>
        <div>
          <PanelTitle>Preview</PanelTitle>
          <PanelDescription>
            Shared normalized document rendered in {mode} mode.
          </PanelDescription>
        </div>
      </PanelHeader>

      <div className={mode === "mobile" ? "mx-auto w-full max-w-sm" : "w-full"}>
        <div className="rounded-[28px] border bg-background p-6 shadow-sm">
          <div className="mb-4 border-b pb-4">
            <div className="text-sm font-semibold">{document.subject || "Untitled subject"}</div>
            <div className="text-muted-foreground mt-1 text-sm">
              {document.previewText || "No preview text yet."}
            </div>
          </div>

          <div className="space-y-6">
            {document.blocks.map((block) => (
              <PreviewBlock key={block.id} block={block} />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}
