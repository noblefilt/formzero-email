import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Trash2, Clock, Copy, Check, Star, Archive, ArchiveRestore } from "lucide-react"
import { useState } from "react"
import type { Submission } from "./columns"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "~/components/ui/sheet"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"

interface DetailPanelProps {
  submission: Submission | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (id: string) => void
  onToggleStar?: (id: string) => void
  onToggleArchive?: (id: string) => void
  isDeleting?: boolean
}

export function DetailPanel({
  submission,
  open,
  onOpenChange,
  onDelete,
  onToggleStar,
  onToggleArchive,
  isDeleting,
}: DetailPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  if (!submission) return null

  const date = new Date(submission.created_at)
  const relativeTime = formatDistanceToNow(date, { addSuffix: true, locale: zhCN })
  const exactTime = date.toLocaleString('zh-CN', {
    dateStyle: "full",
    timeStyle: "medium",
  })

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value)
    setCopiedField(key)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleDelete = () => {
    if (!confirm("确定要删除此提交数据吗？此操作不可撤销。")) return
    onDelete(submission.id)
    onOpenChange(false)
  }

  const dataEntries = Object.entries(submission.data)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>提交详情</SheetTitle>
          <SheetDescription className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>{relativeTime}</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-xs text-muted-foreground/80">{exactTime}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-4 space-y-1">
          {dataEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">此提交数据没有字段。</p>
          ) : (
            dataEntries.map(([key, value]) => {
              const displayValue = value !== undefined && value !== null ? String(value) : ""
              const isLongValue = displayValue.length > 100

              return (
                <div key={key} className="group rounded-lg border p-3 transition-colors hover:bg-muted/50">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {key}
                    </label>
                    {displayValue && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleCopy(key, displayValue)}
                      >
                        {copiedField === key ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                  {isLongValue ? (
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {displayValue}
                    </p>
                  ) : (
                    <p className="text-sm font-medium">{displayValue || <span className="text-muted-foreground italic">空</span>}</p>
                  )}
                </div>
              )
            })
          )}
        </div>

        <Separator />

        <SheetFooter className="flex-row gap-2">
          <div className="text-xs text-muted-foreground truncate flex-1">
            ID: {submission.id}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleStar?.(submission.id)}
            className="gap-1.5"
          >
            <Star className={`h-3.5 w-3.5 ${submission.is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            {submission.is_starred ? "取消星标" : "星标"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleArchive?.(submission.id)}
            className="gap-1.5"
          >
            {submission.is_archived ? (
              <><ArchiveRestore className="h-3.5 w-3.5" />取消归档</>
            ) : (
              <><Archive className="h-3.5 w-3.5" />归档</>
            )}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? "删除中..." : "删除"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
