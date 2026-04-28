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
        {
          id: "starter-launch-brief-text",
          type: "text",
          content: "Introduce the message with a sharp opening paragraph.",
          align: "left",
        },
        {
          id: "starter-launch-brief-image",
          type: "image",
          src: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80",
          alt: "Editorial hero image",
          caption: "Swap with campaign artwork.",
        },
        {
          id: "starter-launch-brief-button",
          type: "button",
          label: "Launch campaign",
          href: "https://example.com",
          align: "left",
        },
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
        {
          id: "starter-product-spotlight-intro",
          type: "text",
          content: "Introduce the message with a sharp opening paragraph.",
          align: "left",
        },
        {
          id: "starter-product-spotlight-divider",
          type: "divider",
          tone: "subtle",
        },
        {
          id: "starter-product-spotlight-details",
          type: "text",
          content: "Introduce the message with a sharp opening paragraph.",
          align: "left",
        },
        {
          id: "starter-product-spotlight-button",
          type: "button",
          label: "Launch campaign",
          href: "https://example.com",
          align: "left",
        },
      ],
    },
  },
]
