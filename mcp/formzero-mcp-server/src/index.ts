import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import {
  FormZeroMcpApiClient,
  getClientConfig,
  type GetSettingsResponse,
  type ResponseFormat,
} from "./client.js"
import {
  renderFormMarkdown,
  renderFormsMarkdown,
  renderSettingsMarkdown,
  renderSpamMarkdown,
  renderSubmissionMarkdown,
  renderSubmissionsMarkdown,
  stringifyJson,
  summarizeFormList,
} from "./renderers.js"

const responseFormatSchema = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe("Response format. Use markdown for human reading or json for structured analysis.")

const paginationSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of records to return."),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of records to skip for pagination."),
}

function buildTextResult<T extends Record<string, unknown>>(
  markdown: string,
  structuredContent: T
) {
  return {
    content: [{ type: "text" as const, text: markdown }],
    structuredContent,
  }
}

function formatResponse<T extends Record<string, unknown>>(
  responseFormat: ResponseFormat,
  markdown: string,
  structuredContent: T
) {
  if (responseFormat === "json") {
    return buildTextResult(stringifyJson(structuredContent), structuredContent)
  }

  return buildTextResult(markdown, structuredContent)
}

async function main() {
  const client = new FormZeroMcpApiClient(getClientConfig())
  const server = new McpServer({
    name: "formzero-mcp-server",
    version: "1.0.0",
  })

  server.registerTool(
    "formzero_list_forms",
    {
      title: "List FormZero Forms",
      description:
        "List forms with submission, unread, and spam counts. Use this first to understand which websites or inboxes need attention.",
      inputSchema: {
        ...paginationSchema,
        response_format: responseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ limit, offset, response_format }) => {
      const result = await client.listForms({ limit, offset })
      return formatResponse(
        response_format,
        renderFormsMarkdown(result),
        {
          ...result,
          summary: summarizeFormList(result.forms),
        }
      )
    }
  )

  server.registerTool(
    "formzero_get_form",
    {
      title: "Get FormZero Form Details",
      description:
        "Get one form's counts and safe notification configuration summary. Useful for understanding a single website's inbox setup.",
      inputSchema: {
        form_id: z
          .string()
          .min(1)
          .describe("FormZero form ID, for example contact or site-a."),
        response_format: responseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ form_id, response_format }) => {
      const result = await client.getForm(form_id)
      return formatResponse(
        response_format,
        renderFormMarkdown(result.form),
        result
      )
    }
  )

  server.registerTool(
    "formzero_list_submissions",
    {
      title: "List FormZero Submissions",
      description:
        "List submissions for one form. This is the main tool for reading inquiry content and deciding how a page or offer should change.",
      inputSchema: {
        form_id: z
          .string()
          .min(1)
          .describe("FormZero form ID to inspect."),
        filter: z
          .enum(["active", "unread", "archived", "all"])
          .default("active")
          .describe("Submission filter. active excludes archived items by default."),
        ...paginationSchema,
        response_format: responseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ form_id, filter, limit, offset, response_format }) => {
      const result = await client.listSubmissions({
        formId: form_id,
        filter,
        limit,
        offset,
      })
      return formatResponse(
        response_format,
        renderSubmissionsMarkdown(result),
        result
      )
    }
  )

  server.registerTool(
    "formzero_get_submission",
    {
      title: "Get FormZero Submission",
      description:
        "Get one specific submission with visible fields, sender details, and message content.",
      inputSchema: {
        submission_id: z
          .string()
          .min(1)
          .describe("Submission ID to inspect."),
        response_format: responseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ submission_id, response_format }) => {
      const result = await client.getSubmission(submission_id)
      return formatResponse(
        response_format,
        renderSubmissionMarkdown(result.submission),
        result
      )
    }
  )

  server.registerTool(
    "formzero_list_spam",
    {
      title: "List FormZero Spam",
      description:
        "List spam records across forms. Useful for understanding junk patterns that should not drive page changes.",
      inputSchema: {
        dedupe_by_email: z
          .boolean()
          .default(true)
          .describe("When true, keep one visible record per repeated spam email."),
        ...paginationSchema,
        response_format: responseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ dedupe_by_email, limit, offset, response_format }) => {
      const result = await client.listSpam({
        dedupeByEmail: dedupe_by_email,
        limit,
        offset,
      })
      return formatResponse(
        response_format,
        renderSpamMarkdown(result),
        result
      )
    }
  )

  server.registerTool(
    "formzero_get_settings",
    {
      title: "Get FormZero Global Settings",
      description:
        "Get the safe global notification settings summary for the current FormZero instance.",
      inputSchema: {
        response_format: responseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      const result: GetSettingsResponse = await client.getSettings()
      return formatResponse(
        response_format,
        renderSettingsMarkdown(result),
        result
      )
    }
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Failed to start FormZero MCP server."
  )
  process.exit(1)
})
