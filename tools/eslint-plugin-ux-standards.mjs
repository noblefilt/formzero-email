const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g
const MS_VALUE_RE = /\b(\d+)ms\b/g
const TAILWIND_SPACING_RE =
  /\b(?:p[trblxy]?|m[trblxy]?|gap|space-[xy])-\[(\d+)px\]/g

const SPACING_KEYS = new Set([
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "gap",
  "rowGap",
  "columnGap",
])

const DURATION_KEYS = new Set([
  "animationDuration",
  "transitionDuration",
  "duration",
])

function getPropertyName(node) {
  if (!node?.key) return null
  if (node.key.type === "Identifier") return node.key.name
  if (node.key.type === "Literal" && typeof node.key.value === "string") {
    return node.key.value
  }
  return null
}

function reportMatches(context, node, value, regex, messageBuilder) {
  if (!value) return

  let match
  regex.lastIndex = 0

  while ((match = regex.exec(value)) !== null) {
    context.report({
      node,
      message: messageBuilder(match[0], match),
    })
  }
}

const noHexColors = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow hardcoded hex colors in application code.",
    },
    schema: [],
  },
  create(context) {
    const inspect = (node, value) => {
      reportMatches(context, node, value, HEX_COLOR_RE, (token) => {
        return `Use a design token instead of hardcoded color "${token}".`
      })
    }

    return {
      Literal(node) {
        if (typeof node.value === "string") inspect(node, node.value)
      },
      TemplateElement(node) {
        inspect(node, node.value.raw)
      },
    }
  },
}

const enforceMotionDurations = {
  meta: {
    type: "problem",
    docs: {
      description: "Restrict motion durations to 150ms and 300ms.",
    },
    schema: [],
  },
  create(context) {
    const reportInvalid = (node, message) => {
      if (message) {
        context.report({ node, message })
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === "string") {
          let match
          MS_VALUE_RE.lastIndex = 0
          while ((match = MS_VALUE_RE.exec(node.value)) !== null) {
            const duration = Number(match[1])
            if (duration !== 150 && duration !== 300) {
              reportInvalid(
                node,
                `Motion duration "${duration}ms" is not allowed. Use 150ms for micro-interactions or 300ms for page transitions.`
              )
            }
          }
        }
      },
      TemplateElement(node) {
        let match
        MS_VALUE_RE.lastIndex = 0
        while ((match = MS_VALUE_RE.exec(node.value.raw)) !== null) {
          const duration = Number(match[1])
          if (duration !== 150 && duration !== 300) {
            reportInvalid(
              node,
              `Motion duration "${duration}ms" is not allowed. Use 150ms for micro-interactions or 300ms for page transitions.`
            )
          }
        }
      },
      Property(node) {
        const propertyName = getPropertyName(node)
        if (!DURATION_KEYS.has(propertyName)) return

        if (node.value.type === "Literal" && typeof node.value.value === "number") {
          if (node.value.value !== 150 && node.value.value !== 300) {
            reportInvalid(
              node.value,
              `Motion duration "${node.value.value}" is not allowed. Use 150 or 300.`
            )
          }
        }
      },
    }
  },
}

const enforce4pxGrid = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce the 4px spacing grid.",
    },
    schema: [],
  },
  create(context) {
    const reportSpacing = (node, value) => {
      if (value % 4 === 0) return

      context.report({
        node,
        message: `Spacing value "${value}px" breaks the 4px grid.`,
      })
    }

    const inspectString = (node, value) => {
      if (!value) return

      let match
      TAILWIND_SPACING_RE.lastIndex = 0

      while ((match = TAILWIND_SPACING_RE.exec(value)) !== null) {
        reportSpacing(node, Number(match[1]))
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === "string") inspectString(node, node.value)
      },
      TemplateElement(node) {
        inspectString(node, node.value.raw)
      },
      Property(node) {
        const propertyName = getPropertyName(node)
        if (!SPACING_KEYS.has(propertyName)) return

        if (node.value.type === "Literal" && typeof node.value.value === "number") {
          reportSpacing(node.value, node.value.value)
        }

        if (node.value.type === "Literal" && typeof node.value.value === "string") {
          const match = node.value.value.match(/^(\d+)px$/)
          if (match) {
            reportSpacing(node.value, Number(match[1]))
          }
        }
      },
    }
  },
}

export default {
  rules: {
    "no-hex-colors": noHexColors,
    "enforce-motion-durations": enforceMotionDurations,
    "enforce-4px-grid": enforce4pxGrid,
  },
}
