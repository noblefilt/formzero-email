import type { Route } from "./+types/api.forms.$formId.submissions";
import { data, redirect } from "react-router";
import { sendSubmissionNotification } from "~/lib/email.server";
import type { EmailConfig } from "#/types/settings";
import {
  buildSubmissionCorsHeaders,
  isOriginAllowed,
  normalizeAllowedOrigin,
  parseAllowedOrigins,
} from "~/lib/allowed-origins";
import { deliverWebhook } from "~/lib/webhooks";
import { extractBearerToken, verifyServerToken } from "~/lib/server-token";
import {
  cleanSubmissionData,
  getSubmissionEmail,
  getSubmissionSourceDomain,
  isSpamSubmission,
  shouldSuppressSpamBurst,
  SPAM_BURST_WINDOW_MS,
} from "~/lib/submission-spam";

function isIdempotencyConflict(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: submissions.form_id, submissions.idempotency_key")
  )
}

// Handle preflight OPTIONS requests
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const requestOrigin = request.headers.get("origin");
  const form = await db
    .prepare("SELECT allowed_origins FROM forms WHERE id = ?")
    .bind(params.formId)
    .first<{ allowed_origins: string | null }>();
  const allowedOrigins = parseAllowedOrigins(form?.allowed_origins).origins;
  const corsHeaders = buildSubmissionCorsHeaders(requestOrigin, allowedOrigins);

  if (request.method !== "OPTIONS") {
    return data(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders }
    );
  }

  if (!form) {
    return data(
      { success: false, error: "Form not found" },
      { status: 404, headers: corsHeaders }
    );
  }

  if (!isOriginAllowed(requestOrigin, allowedOrigins)) {
    return data(
      { success: false, error: "Origin not allowed" },
      { status: 403, headers: corsHeaders }
    );
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { formId } = params;
  const db = context.cloudflare.env.DB;

  // Determine if this is a JSON request (used throughout)
  const contentType = request.headers.get("content-type") || "";
  const acceptHeader = request.headers.get("accept") || "";
  const isJsonRequest =
    acceptHeader.includes("application/json") ||
    contentType.includes("application/json");
  const requestOrigin = request.headers.get("origin");
  const fallbackCorsHeaders = buildSubmissionCorsHeaders(requestOrigin, []);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || null;
  const serverToken = extractBearerToken(request.headers);

  try {
    // Check if form exists
    const form = await db
      .prepare("SELECT id, name, allowed_origins, notification_email, notification_email_password, smtp_host, smtp_port, webhook_url, webhook_secret, server_token_hash FROM forms WHERE id = ?")
      .bind(formId)
      .first<{
        id: string
        name: string
        allowed_origins: string | null
        notification_email: string | null
        notification_email_password: string | null
        smtp_host: string | null
        smtp_port: number | null
        webhook_url: string | null
        webhook_secret: string | null
        server_token_hash: string | null
      }>();
    const allowedOrigins = parseAllowedOrigins(form?.allowed_origins).origins;
    const corsHeaders = buildSubmissionCorsHeaders(requestOrigin, allowedOrigins);

    if (!form) {
      if (isJsonRequest) {
        return data(
          { success: false, error: "Form not found" },
          { status: 404, headers: corsHeaders }
        );
      }
      return redirect("/error?error=form_not_found");
    }

    if (!isOriginAllowed(requestOrigin, allowedOrigins)) {
      if (isJsonRequest) {
        return data(
          { success: false, error: "Origin not allowed" },
          { status: 403, headers: corsHeaders }
        );
      }

      return redirect("/error?error=origin_not_allowed");
    }

    const hasServerToken = Boolean(form.server_token_hash)
    const validServerToken = serverToken && form.server_token_hash
      ? await verifyServerToken(serverToken, form.server_token_hash)
      : false

    if (!requestOrigin && hasServerToken && !validServerToken) {
      if (isJsonRequest) {
        return data(
          { success: false, error: "Invalid server token" },
          { status: 401, headers: corsHeaders }
        )
      }

      return redirect("/error?error=invalid_server_token")
    }

    if (idempotencyKey) {
      const existingSubmission = await db
        .prepare(
          "SELECT id, created_at FROM submissions WHERE form_id = ? AND idempotency_key = ? LIMIT 1"
        )
        .bind(formId, idempotencyKey)
        .first<{ id: string; created_at: number }>()

      if (existingSubmission) {
        if (isJsonRequest) {
          return data(
            {
              success: true,
              id: existingSubmission.id,
              duplicate: true,
            },
            { status: 200, headers: corsHeaders }
          )
        }

        const redirectParam = new URL(request.url).searchParams.get("redirect")
        return redirect(redirectParam || "/success", 303)
      }
    }

    // Parse request body based on content type
    let submissionData: Record<string, unknown>;

    if (contentType.includes("application/json")) {
      submissionData = await request.json();
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await request.formData();
      submissionData = Object.fromEntries(formData);
    } else {
      if (isJsonRequest) {
        return data(
          { success: false, error: "Unsupported content type" },
          { status: 415, headers: corsHeaders }
        );
      }
      return redirect("/error?error=unsupported_content_type");
    }

    const isSpam = isSpamSubmission(submissionData)
    const createdAt = Date.now();
    const requestSource = requestOrigin
      ? "browser"
      : validServerToken
        ? "server_token"
        : "direct";
    const normalizedRequestOrigin = requestOrigin
      ? normalizeAllowedOrigin(requestOrigin)
      : null

    // --- IP-based rate limiting ---
    const clientIP = request.headers.get("cf-connecting-ip")
      || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || "unknown";
    const rateLimitWindow = Date.now() - 60 * 1000; // 1 minute window
    const recentSubmissions = await db
      .prepare(
        "SELECT COUNT(*) as cnt FROM submissions WHERE form_id = ? AND created_at > ? AND ip_address = ?"
      )
      .bind(formId, rateLimitWindow, clientIP)
      .first<{ cnt: number }>();

    if (recentSubmissions && recentSubmissions.cnt >= 5) {
      if (isSpam) {
        if (isJsonRequest) {
          return data(
            { success: true, suppressedSpam: true },
            { status: 201, headers: corsHeaders }
          )
        }

        const redirectParam = new URL(request.url).searchParams.get("redirect")
        return redirect(redirectParam || "/success", 303)
      }

      if (isJsonRequest) {
        return data(
          { success: false, error: "Too many requests. Please try again later." },
          { status: 429, headers: corsHeaders }
        );
      }
      return redirect("/error?error=rate_limited");
    }

    // Extract _redirect from submission data (hidden field) and remove from stored data
    const formRedirectUrl = submissionData._redirect as string | undefined;
    const cleanedData = cleanSubmissionData(submissionData);

    if (isSpam) {
      const spamBurstWindowStart = createdAt - SPAM_BURST_WINDOW_MS
      const spamEmail = getSubmissionEmail(cleanedData)
      const spamSourceDomain = getSubmissionSourceDomain(
        cleanedData,
        normalizedRequestOrigin
      )
      const recentSpamByEmail = spamEmail
        ? await db
          .prepare(
            `SELECT COUNT(*) AS count
             FROM submissions
             WHERE form_id = ?
               AND COALESCE(is_spam, 0) = 1
               AND created_at > ?
               AND lower(json_extract(data, '$.email')) = lower(?)`
          )
          .bind(formId, spamBurstWindowStart, spamEmail)
          .first<{ count: number }>()
        : { count: 0 }
      const recentSpamBySourceDomain =
        spamSourceDomain !== "直接提交"
          ? await db
            .prepare(
              `SELECT COUNT(*) AS count
               FROM submissions
               WHERE form_id = ?
                 AND COALESCE(is_spam, 0) = 1
                 AND created_at > ?
                 AND request_origin = ?`
            )
            .bind(formId, spamBurstWindowStart, normalizedRequestOrigin)
            .first<{ count: number }>()
          : { count: 0 }

      if (
        shouldSuppressSpamBurst({
          emailCount: recentSpamByEmail?.count ?? 0,
          sourceDomainCount: recentSpamBySourceDomain?.count ?? 0,
        })
      ) {
        if (isJsonRequest) {
          return data(
            { success: true, suppressedSpam: true },
            { status: 201, headers: corsHeaders }
          )
        }

        const redirectParam = new URL(request.url).searchParams.get("redirect")
        return redirect(redirectParam || formRedirectUrl || "/success", 303)
      }
    }

    // Generate submission ID after suppression checks so dropped spam does not
    // consume storage or trigger side effects.
    const submissionId = crypto.randomUUID();

    // Store submission in database
    try {
      await db
        .prepare(
          "INSERT INTO submissions (id, form_id, data, created_at, ip_address, idempotency_key, request_origin, request_source, is_spam) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          submissionId,
          formId,
          JSON.stringify(cleanedData),
          createdAt,
          clientIP,
          idempotencyKey,
          normalizedRequestOrigin,
          requestSource,
          isSpam ? 1 : 0
        )
        .run();
    } catch (error) {
      if (idempotencyKey && isIdempotencyConflict(error)) {
        const existingSubmission = await db
          .prepare(
            "SELECT id FROM submissions WHERE form_id = ? AND idempotency_key = ? LIMIT 1"
          )
          .bind(formId, idempotencyKey)
          .first<{ id: string }>()

        if (existingSubmission) {
          if (isJsonRequest) {
            return data(
              {
                success: true,
                id: existingSubmission.id,
                duplicate: true,
              },
              { status: 200, headers: corsHeaders }
            )
          }

          const redirectParam = new URL(request.url).searchParams.get("redirect")
          return redirect(redirectParam || "/success", 303)
        }
      }

      throw error
    }

    if (!isSpam) {
      // Send email notification asynchronously (don't await to avoid blocking response)
      // This runs in the background after the response is sent
      context.cloudflare.ctx.waitUntil(
        (async () => {
          try {
            const backgroundTasks: Promise<unknown>[] = []

            // Check per-form email settings first, then fall back to global
            let emailConfig: EmailConfig | null = null;

            if (
              form.notification_email &&
              form.notification_email_password &&
              form.smtp_host &&
              form.smtp_port
            ) {
              // Use per-form email settings
              emailConfig = {
                notification_email: form.notification_email,
                notification_email_password: form.notification_email_password,
                smtp_host: form.smtp_host,
                smtp_port: form.smtp_port,
              };
            } else {
              // Fall back to global settings
              const globalSettings = await db
                .prepare(
                  "SELECT notification_email, notification_email_password, smtp_host, smtp_port FROM settings WHERE id = 'global'"
                )
                .first<{
                  notification_email: string | null
                  notification_email_password: string | null
                  smtp_host: string | null
                  smtp_port: number | null
                }>();

              if (
                globalSettings?.notification_email &&
                globalSettings?.notification_email_password &&
                globalSettings?.smtp_host &&
                globalSettings?.smtp_port
              ) {
                emailConfig = {
                  notification_email: globalSettings.notification_email,
                  notification_email_password: globalSettings.notification_email_password,
                  smtp_host: globalSettings.smtp_host,
                  smtp_port: globalSettings.smtp_port,
                };
              }
            }

            if (emailConfig) {
              backgroundTasks.push(
                sendSubmissionNotification(emailConfig, {
                  id: submissionId,
                  formId: formId,
                  formName: form.name,
                  data: cleanedData,
                  createdAt: createdAt,
                })
              )
            }

            if (form.webhook_url && form.webhook_secret) {
              backgroundTasks.push(
                deliverWebhook({
                  db,
                  form: {
                    id: form.id,
                    name: form.name,
                    webhook_url: form.webhook_url,
                    webhook_secret: form.webhook_secret,
                  },
                  submission: {
                    id: submissionId,
                    createdAt,
                    idempotencyKey,
                    source: requestSource,
                    origin: normalizedRequestOrigin,
                    data: cleanedData,
                  },
                })
              )
            }

            await Promise.allSettled(backgroundTasks)
          } catch (error) {
            // Log error but don't fail the request
            console.error("Failed to run submission side effects:", error);
          }
        })()
      );
    }

    if (isJsonRequest) {
      // Return JSON response
      return data(
        { success: true, id: submissionId },
        { status: 201, headers: corsHeaders }
      );
    } else {
      // Handle redirect for HTML form submissions
      // Priority: ?redirect= query param > _redirect hidden field > success page
      const url = new URL(request.url);
      const redirectParam = url.searchParams.get("redirect");

      let redirectUrl: string;

      if (redirectParam) {
        redirectUrl = redirectParam;
      } else if (formRedirectUrl) {
        redirectUrl = formRedirectUrl;
      } else {
        redirectUrl = "/success";
      }

      return redirect(redirectUrl, 303);
    }
  } catch (error) {
    console.error("Error processing form submission:", error);

    if (isJsonRequest) {
      return data(
        { success: false, error: "Failed to process submission" },
        { status: 500, headers: fallbackCorsHeaders }
      );
    } else {
      return redirect("/error?error=internal_error");
    }
  }
}
