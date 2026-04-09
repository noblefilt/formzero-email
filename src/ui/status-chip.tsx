import type * as React from "react"
import { CheckCircle2, LoaderCircle, OctagonAlert } from "lucide-react"

import { cn } from "#/lib/utils"

import type { UxAutosaveState, UxFeedbackState } from "./ux-standards"

type StatusChipProps = {
  label: string
  state: UxAutosaveState | UxFeedbackState
} & React.ComponentProps<"span">

export function StatusChip({
  label,
  state,
  className,
  ...props
}: StatusChipProps) {
  const icon =
    state === "loading" || state === "saving" ? (
      <LoaderCircle className="size-3.5 animate-spin" />
    ) : state === "success" || state === "saved" ? (
      <CheckCircle2 className="size-3.5" />
    ) : state === "error" ? (
      <OctagonAlert className="size-3.5" />
    ) : (
      <div className="size-2 rounded-full bg-muted-foreground/60" />
    )

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150",
        state === "loading" || state === "saving"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "",
        state === "success" || state === "saved"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "",
        state === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "",
        state === "idle" ? "border-border bg-background text-muted-foreground" : "",
        className
      )}
      {...props}
    >
      {icon}
      <span>{label}</span>
    </span>
  )
}
