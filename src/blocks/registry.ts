import type {
  BlockDefinition,
  BlockValidation,
  ButtonBlock,
  DividerBlock,
  EmailBlock,
  EmailBlockType,
  HtmlBlock,
  ImageBlock,
  SpacerBlock,
  TextBlock,
} from "./types"

function createBlockId(type: EmailBlockType) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${type}-${crypto.randomUUID()}`
  }

  return `${type}-${Math.random().toString(36).slice(2, 10)}`
}

const textDefinition: BlockDefinition<TextBlock> = {
  type: "text",
  label: "Text",
  description: "Paragraph copy with live editing.",
  create: () => ({
    id: createBlockId("text"),
    type: "text",
    content: "Introduce the message with a sharp opening paragraph.",
    align: "left",
  }),
  summarize: (block) => block.content.slice(0, 60) || "Empty text block",
  validate: (block) =>
    block.content.trim()
      ? []
      : [{ level: "warning", message: "Text block is empty." }],
}

const imageDefinition: BlockDefinition<ImageBlock> = {
  type: "image",
  label: "Image",
  description: "Hero or supporting image with alt text.",
  create: () => ({
    id: createBlockId("image"),
    type: "image",
    src: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80",
    alt: "Editorial hero image",
    caption: "Swap with campaign artwork.",
  }),
  summarize: (block) => block.alt || block.caption || "Image block",
  validate: (block) => {
    const issues: BlockValidation[] = []

    if (!block.src.trim()) {
      issues.push({ level: "error", message: "Image source is required." })
    }

    if (!block.alt.trim()) {
      issues.push({ level: "error", message: "Image alt text is required." })
    }

    return issues
  },
}

const buttonDefinition: BlockDefinition<ButtonBlock> = {
  type: "button",
  label: "Button",
  description: "Primary call to action.",
  create: () => ({
    id: createBlockId("button"),
    type: "button",
    label: "Launch campaign",
    href: "https://example.com",
    align: "left",
  }),
  summarize: (block) => block.label || "Button block",
  validate: (block) => {
    const issues: BlockValidation[] = []

    if (!block.label.trim()) {
      issues.push({ level: "error", message: "Button label is required." })
    }

    if (!block.href.trim()) {
      issues.push({ level: "error", message: "Button URL is required." })
    }

    return issues
  },
}

const dividerDefinition: BlockDefinition<DividerBlock> = {
  type: "divider",
  label: "Divider",
  description: "Visual rhythm between content blocks.",
  create: () => ({
    id: createBlockId("divider"),
    type: "divider",
    tone: "subtle",
  }),
  summarize: (block) => `${block.tone} divider`,
  validate: () => [],
}

const spacerDefinition: BlockDefinition<SpacerBlock> = {
  type: "spacer",
  label: "Spacer",
  description: "Vertical breathing room.",
  create: () => ({
    id: createBlockId("spacer"),
    type: "spacer",
    size: 24,
  }),
  summarize: (block) => `${block.size}px spacer`,
  validate: () => [],
}

const htmlDefinition: BlockDefinition<HtmlBlock> = {
  type: "html",
  label: "HTML",
  description: "Escape hatch for custom markup.",
  create: () => ({
    id: createBlockId("html"),
    type: "html",
    html: "<p>Custom HTML content</p>",
  }),
  summarize: (block) => block.html.slice(0, 40) || "HTML block",
  validate: (block) =>
    block.html.trim()
      ? []
      : [{ level: "warning", message: "Custom HTML block is empty." }],
}

export const blockRegistry = [
  textDefinition,
  imageDefinition,
  buttonDefinition,
  dividerDefinition,
  spacerDefinition,
  htmlDefinition,
] as const

export function getBlockDefinition(type: EmailBlockType) {
  const definition = blockRegistry.find((item) => item.type === type)

  if (!definition) {
    throw new Error(`Unknown block type "${type}".`)
  }

  return definition
}

export function createBlock(type: EmailBlockType): EmailBlock {
  return getBlockDefinition(type).create()
}

export function validateBlock(block: EmailBlock): BlockValidation[] {
  return getBlockDefinition(block.type).validate(block as never)
}
