export type EmailBlockType =
  | "text"
  | "image"
  | "button"
  | "divider"
  | "spacer"
  | "html"

type BlockBase<TType extends EmailBlockType> = {
  id: string
  type: TType
}

export type TextBlock = BlockBase<"text"> & {
  content: string
  align: "left" | "center" | "right"
}

export type ImageBlock = BlockBase<"image"> & {
  src: string
  alt: string
  caption: string
}

export type ButtonBlock = BlockBase<"button"> & {
  label: string
  href: string
  align: "left" | "center" | "right"
}

export type DividerBlock = BlockBase<"divider"> & {
  tone: "subtle" | "strong"
}

export type SpacerBlock = BlockBase<"spacer"> & {
  size: 16 | 24 | 32 | 40
}

export type HtmlBlock = BlockBase<"html"> & {
  html: string
}

export type EmailBlock =
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | HtmlBlock

export type BlockValidation = {
  level: "error" | "warning"
  message: string
}

export type BlockDefinition<TBlock extends EmailBlock = EmailBlock> = {
  type: TBlock["type"]
  label: string
  description: string
  create: () => TBlock
  summarize: (block: TBlock) => string
  validate: (block: TBlock) => BlockValidation[]
}
