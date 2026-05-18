import { data, type LoaderFunctionArgs } from "react-router"
import {
  buildMcpHeaders,
  getPaginationParams,
  getSpamDedupeFlag,
  getSubmissionFilter,
  getMcpRouteConfig,
  getFormDetailsForMcp,
  getGlobalSettingsForMcp,
  getSubmissionForMcp,
  listFormsForMcp,
  listSpamForMcp,
  listSubmissionsForMcp,
  validateMcpRequest,
} from "#/lib/mcp-read.server"

function getSplatPath(params: Record<string, string | undefined>) {
  return (params["*"] || "").replace(/^\/+|\/+$/g, "")
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const authResult = validateMcpRequest(request, context.cloudflare.env)
  if (!authResult.ok) {
    return data(
      { success: false, error: authResult.error },
      { status: authResult.status, headers: buildMcpHeaders() }
    )
  }

  if (request.method !== "GET") {
    return data(
      { success: false, error: "Method not allowed" },
      { status: 405, headers: buildMcpHeaders() }
    )
  }

  const db = context.cloudflare.env.DB
  const url = new URL(request.url)
  const path = getSplatPath(params)
  const segments = path ? path.split("/") : []
  const pagination = getPaginationParams(url)

  if (segments.length === 1 && segments[0] === "forms") {
    return data(await listFormsForMcp(db, pagination), {
      headers: buildMcpHeaders(),
    })
  }

  if (segments.length === 2 && segments[0] === "forms") {
    const result = await getFormDetailsForMcp(db, segments[1])
    if (!result) {
      return data(
        { success: false, error: "Form not found" },
        { status: 404, headers: buildMcpHeaders() }
      )
    }

    return data(result, { headers: buildMcpHeaders() })
  }

  if (
    segments.length === 3 &&
    segments[0] === "forms" &&
    segments[2] === "submissions"
  ) {
    const result = await listSubmissionsForMcp(db, segments[1], {
      filter: getSubmissionFilter(url),
      ...pagination,
    })
    if (!result) {
      return data(
        { success: false, error: "Form not found" },
        { status: 404, headers: buildMcpHeaders() }
      )
    }

    return data(result, { headers: buildMcpHeaders() })
  }

  if (segments.length === 2 && segments[0] === "submissions") {
    const result = await getSubmissionForMcp(db, segments[1])
    if (!result) {
      return data(
        { success: false, error: "Submission not found" },
        { status: 404, headers: buildMcpHeaders() }
      )
    }

    return data(result, { headers: buildMcpHeaders() })
  }

  if (segments.length === 1 && segments[0] === "spam") {
    return data(
      await listSpamForMcp(db, {
        dedupeByEmail: getSpamDedupeFlag(url),
        ...pagination,
      }),
      { headers: buildMcpHeaders() }
    )
  }

  if (segments.length === 1 && segments[0] === "settings") {
    return data(await getGlobalSettingsForMcp(db), {
      headers: buildMcpHeaders(),
    })
  }

  return data(
    {
      success: false,
      error: "Unknown MCP endpoint",
      endpoints: [
        "/api/mcp/forms",
        "/api/mcp/forms/:formId",
        "/api/mcp/forms/:formId/submissions",
        "/api/mcp/submissions/:submissionId",
        "/api/mcp/spam",
        "/api/mcp/settings",
      ],
      pagination: getMcpRouteConfig(),
    },
    { status: 404, headers: buildMcpHeaders() }
  )
}
