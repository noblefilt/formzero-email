const TEXT_ENCODER = new TextEncoder()
const WEBHOOK_EVENT = "submission.created"
const MAX_RESPONSE_BODY_LENGTH = 4000

type SubmissionWebhookPayload = {
  event: typeof WEBHOOK_EVENT
  delivery: {
    id: string
    timestamp: string
    attempt: number
    replayedFromDeliveryId: string | null
  }
  form: {
    id: string
    name: string
  }
  submission: {
    id: string
    createdAt: number
    idempotencyKey: string | null
    source: string
    origin: string | null
    data: Record<string, unknown>
  }
}

type DeliverWebhookArgs = {
  db: D1Database
  form: {
    id: string
    name: string
    webhook_url: string
    webhook_secret: string
  }
  submission: {
    id: string
    createdAt: number
    idempotencyKey: string | null
    source: string
    origin: string | null
    data: Record<string, unknown>
  }
  replayedFromDeliveryId?: string | null
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function truncateText(value: string) {
  return value.length > MAX_RESPONSE_BODY_LENGTH
    ? `${value.slice(0, MAX_RESPONSE_BODY_LENGTH)}...`
    : value
}

export async function signWebhookPayload(
  secret: string,
  timestamp: string,
  requestBody: string
) {
  const key = await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    TEXT_ENCODER.encode(`${timestamp}.${requestBody}`)
  )

  return bytesToHex(new Uint8Array(signature))
}

export function buildWebhookPayload(args: {
  deliveryId: string
  attemptNumber: number
  replayedFromDeliveryId: string | null
  form: DeliverWebhookArgs["form"]
  submission: DeliverWebhookArgs["submission"]
  timestamp: string
}): SubmissionWebhookPayload {
  return {
    event: WEBHOOK_EVENT,
    delivery: {
      id: args.deliveryId,
      timestamp: args.timestamp,
      attempt: args.attemptNumber,
      replayedFromDeliveryId: args.replayedFromDeliveryId,
    },
    form: {
      id: args.form.id,
      name: args.form.name,
    },
    submission: {
      id: args.submission.id,
      createdAt: args.submission.createdAt,
      idempotencyKey: args.submission.idempotencyKey,
      source: args.submission.source,
      origin: args.submission.origin,
      data: args.submission.data,
    },
  }
}

async function createPendingDeliveryLog(args: {
  db: D1Database
  formId: string
  submissionId: string
  targetUrl: string
  requestBody: string
  requestSignature: string
  requestTimestamp: string
  replayedFromDeliveryId: string | null
}) {
  const createdAt = Date.now()
  const deliveryId = crypto.randomUUID()

  const attemptCount = await args.db
    .prepare(
      "SELECT COUNT(*) as count FROM webhook_deliveries WHERE submission_id = ?"
    )
    .bind(args.submissionId)
    .first<{ count: number }>()

  const attemptNumber = (attemptCount?.count || 0) + 1

  await args.db
    .prepare(`
      INSERT INTO webhook_deliveries (
        id,
        form_id,
        submission_id,
        event_type,
        target_url,
        request_body,
        request_signature,
        request_timestamp,
        status,
        attempt_number,
        replayed_from_delivery_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `)
    .bind(
      deliveryId,
      args.formId,
      args.submissionId,
      WEBHOOK_EVENT,
      args.targetUrl,
      args.requestBody,
      args.requestSignature,
      args.requestTimestamp,
      attemptNumber,
      args.replayedFromDeliveryId,
      createdAt,
      createdAt
    )
    .run()

  return {
    deliveryId,
    attemptNumber,
  }
}

async function updateDeliveryLog(args: {
  db: D1Database
  deliveryId: string
  status: "delivered" | "failed"
  statusCode: number | null
  responseBody: string | null
  errorMessage: string | null
}) {
  const deliveredAt = Date.now()

  await args.db
    .prepare(`
      UPDATE webhook_deliveries
      SET status = ?,
          status_code = ?,
          response_body = ?,
          error_message = ?,
          delivered_at = ?,
          updated_at = ?
      WHERE id = ?
    `)
    .bind(
      args.status,
      args.statusCode,
      args.responseBody,
      args.errorMessage,
      deliveredAt,
      deliveredAt,
      args.deliveryId
    )
    .run()
}

export async function deliverWebhook({
  db,
  form,
  submission,
  replayedFromDeliveryId = null,
}: DeliverWebhookArgs) {
  const initialTimestamp = new Date().toISOString()
  const pendingPayload = buildWebhookPayload({
    deliveryId: crypto.randomUUID(),
    attemptNumber: 1,
    replayedFromDeliveryId,
    form,
    submission,
    timestamp: initialTimestamp,
  })
  const pendingRequestBody = JSON.stringify(pendingPayload)
  const pendingSignature = await signWebhookPayload(
    form.webhook_secret,
    initialTimestamp,
    pendingRequestBody
  )

  const pendingDelivery = await createPendingDeliveryLog({
    db,
    formId: form.id,
    submissionId: submission.id,
    targetUrl: form.webhook_url,
    requestBody: pendingRequestBody,
    requestSignature: `sha256=${pendingSignature}`,
    requestTimestamp: initialTimestamp,
    replayedFromDeliveryId,
  })

  const timestamp = new Date().toISOString()
  const payload = buildWebhookPayload({
    deliveryId: pendingDelivery.deliveryId,
    attemptNumber: pendingDelivery.attemptNumber,
    replayedFromDeliveryId,
    form,
    submission,
    timestamp,
  })
  const requestBody = JSON.stringify(payload)
  const signature = await signWebhookPayload(form.webhook_secret, timestamp, requestBody)

  await db
    .prepare(`
      UPDATE webhook_deliveries
      SET request_body = ?,
          request_signature = ?,
          request_timestamp = ?,
          updated_at = ?
      WHERE id = ?
    `)
    .bind(
      requestBody,
      `sha256=${signature}`,
      timestamp,
      Date.now(),
      pendingDelivery.deliveryId
    )
    .run()

  try {
    const response = await fetch(form.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "FormZero Webhooks",
        "X-FormZero-Event": WEBHOOK_EVENT,
        "X-FormZero-Delivery-Id": pendingDelivery.deliveryId,
        "X-FormZero-Timestamp": timestamp,
        "X-FormZero-Signature": `sha256=${signature}`,
      },
      body: requestBody,
    })

    const responseBody = truncateText(await response.text())

    await updateDeliveryLog({
      db,
      deliveryId: pendingDelivery.deliveryId,
      status: response.ok ? "delivered" : "failed",
      statusCode: response.status,
      responseBody,
      errorMessage: response.ok ? null : `Webhook returned ${response.status}`,
    })

    return {
      success: response.ok,
      deliveryId: pendingDelivery.deliveryId,
    }
  } catch (error) {
    await updateDeliveryLog({
      db,
      deliveryId: pendingDelivery.deliveryId,
      status: "failed",
      statusCode: null,
      responseBody: null,
      errorMessage: error instanceof Error ? truncateText(error.message) : "Webhook delivery failed",
    })

    return {
      success: false,
      deliveryId: pendingDelivery.deliveryId,
    }
  }
}
