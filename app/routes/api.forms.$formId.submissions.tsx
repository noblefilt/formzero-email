import type { Route } from "./+types/api.forms.$formId.submissions";
import { data, redirect } from "react-router";
import { sendSubmissionNotification } from "~/lib/email.server";
import type { EmailConfig } from "#/types/settings";

// CORS headers to allow submissions from any domain
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

// Handle preflight OPTIONS requests
export async function loader({ request }: Route.LoaderArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // For non-OPTIONS requests to this endpoint, return method not allowed
  return data(
    { error: "Method not allowed" },
    { status: 405, headers: corsHeaders }
  );
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

  try {
    // Check if form exists
    const form = await db
      .prepare("SELECT id FROM forms WHERE id = ?")
      .bind(formId)
      .first();

    if (!form) {
      if (isJsonRequest) {
        return data(
          { success: false, error: "Form not found" },
          { status: 404, headers: corsHeaders }
        );
      }
      return redirect("/error?error=form_not_found");
    }

    // Parse request body based on content type
    let submissionData: Record<string, any>;

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

    // --- Honeypot spam protection ---
    // If _gotcha field has a value, silently reject (bots fill all fields)
    if (submissionData._gotcha) {
      // Return fake success to not alert bots
      if (isJsonRequest) {
        return data(
          { success: true, id: crypto.randomUUID() },
          { status: 201, headers: corsHeaders }
        );
      }
      return redirect("/success", 303);
    }

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
      if (isJsonRequest) {
        return data(
          { success: false, error: "Too many requests. Please try again later." },
          { status: 429, headers: corsHeaders }
        );
      }
      return redirect("/error?error=rate_limited");
    }

    // Generate submission ID and timestamp
    const submissionId = crypto.randomUUID();
    const createdAt = Date.now();

    // Extract _redirect from submission data (hidden field) and remove from stored data
    const formRedirectUrl = submissionData._redirect as string | undefined;
    const cleanedData = { ...submissionData };
    delete cleanedData._redirect;
    delete cleanedData._gotcha;

    // Store submission in database
    await db
      .prepare(
        "INSERT INTO submissions (id, form_id, data, created_at, ip_address) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(submissionId, formId, JSON.stringify(cleanedData), createdAt, clientIP)
      .run();

    // Send email notification asynchronously (don't await to avoid blocking response)
    // This runs in the background after the response is sent
    context.cloudflare.ctx.waitUntil(
      (async () => {
        try {
          // Fetch form details including per-form email settings
          const formRecord = await db
            .prepare(
              "SELECT name, notification_email, notification_email_password, smtp_host, smtp_port FROM forms WHERE id = ?"
            )
            .bind(formId)
            .first<{
              name: string
              notification_email: string | null
              notification_email_password: string | null
              smtp_host: string | null
              smtp_port: number | null
            }>();

          if (!formRecord) return;

          // Check per-form email settings first, then fall back to global
          let emailConfig: EmailConfig | null = null;

          if (
            formRecord.notification_email &&
            formRecord.notification_email_password &&
            formRecord.smtp_host &&
            formRecord.smtp_port
          ) {
            // Use per-form email settings
            emailConfig = {
              notification_email: formRecord.notification_email,
              notification_email_password: formRecord.notification_email_password,
              smtp_host: formRecord.smtp_host,
              smtp_port: formRecord.smtp_port,
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
            await sendSubmissionNotification(emailConfig, {
              id: submissionId,
              formId: formId,
              formName: formRecord.name,
              data: cleanedData,
              createdAt: createdAt,
            });
          }
        } catch (error) {
          // Log error but don't fail the request
          console.error("Failed to send email notification:", error);
        }
      })()
    );

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
        { status: 500, headers: corsHeaders }
      );
    } else {
      return redirect("/error?error=internal_error");
    }
  }
}
