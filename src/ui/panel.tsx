import type * as React from "react"

import { cn } from "#/lib/utils"

export function Panel({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border bg-card/70 p-4 shadow-sm backdrop-blur",
        className
      )}
      {...props}
    />
  )
}

export function PanelHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4", className)}
      {...props}
    />
  )
}

export function PanelTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("text-sm font-semibold tracking-tight", className)} {...props} />
  )
}

export function PanelDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-muted-foreground text-sm leading-6", className)} {...props} />
  )
}
