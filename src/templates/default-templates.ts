import { createBlock } from "../blocks/registry"
import type { EmailTemplateRecord } from "./types"

const now = new Date().toISOString()

export const defaultTemplates: EmailTemplateRecord[] = [
  {
    id: "starter-launch-brief",
    name: "Launch Brief",
    status: "starter",
    summary: "Fast campaign outline with hero image and one CTA.",
    updatedAt: now,
    document: {
      id: "starter-launch-brief",
      name: "Launch Brief",
      subject: "Your launch brief is ready",
      previewText: "A concise update with one sharp CTA.",
      updatedAt: now,
      schemaVersion: 1,
      blocks: [
        createBlock("text"),
        createBlock("image"),
        createBlock("button"),
      ],
    },
  },
  {
    id: "starter-product-spotlight",
    name: "Product Spotlight",
    status: "starter",
    summary: "Editorial layout for showcasing one feature or offer.",
    updatedAt: now,
    document: {
      id: "starter-product-spotlight",
      name: "Product Spotlight",
      subject: "A sharper way to ship your next campaign",
      previewText: "Highlight the product story before the CTA.",
      updatedAt: now,
      schemaVersion: 1,
      blocks: [
        createBlock("text"),
        createBlock("divider"),
        createBlock("text"),
        createBlock("button"),
      ],
    },
  },
]
