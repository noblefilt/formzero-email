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
  label: "文本",
  description: "正文段落，底层类型仍是 text。",
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
      : [{ level: "warning", message: "文本内容为空。" }],
}

const imageDefinition: BlockDefinition<ImageBlock> = {
  type: "image",
  label: "图片",
  description: "图片和替代文本，底层类型仍是 image。",
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
      issues.push({ level: "error", message: "图片地址必填。" })
    }

    if (!block.alt.trim()) {
      issues.push({ level: "error", message: "图片 Alt 文本必填。" })
    }

    return issues
  },
}

const buttonDefinition: BlockDefinition<ButtonBlock> = {
  type: "button",
  label: "按钮",
  description: "主要行动按钮，底层类型仍是 button。",
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
      issues.push({ level: "error", message: "按钮文字必填。" })
    }

    if (!block.href.trim()) {
      issues.push({ level: "error", message: "按钮链接必填。" })
    }

    return issues
  },
}

const dividerDefinition: BlockDefinition<DividerBlock> = {
  type: "divider",
  label: "分割线",
  description: "分隔内容，底层类型仍是 divider。",
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
  label: "间距",
  description: "垂直留白，底层类型仍是 spacer。",
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
  description: "自定义 HTML，底层类型仍是 html。",
  create: () => ({
    id: createBlockId("html"),
    type: "html",
    html: "<p>Custom HTML content</p>",
  }),
  summarize: (block) => block.html.slice(0, 40) || "HTML block",
  validate: (block) =>
    block.html.trim()
      ? []
      : [{ level: "warning", message: "HTML 内容为空。" }],
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
