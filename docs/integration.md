# Integration

`/forms/:formId/integration` is the operator-facing setup surface for browser and
server-side form submissions.

## Endpoint contract

- HTML forms submit to `/api/forms/:formId/submissions` with `method="POST"`.
- JavaScript clients can send JSON to the same endpoint.
- `_gotcha` remains the built-in honeypot field name.
- `_redirect` remains the built-in post-submit redirect field name.

## Allowed origins

Each form can optionally define an **allowed origins** list.

- Leave it empty to accept browser submissions from any website.
- Add one origin per line, for example `https://www.example.com`.
- Only the origin is stored. Paths and query strings are ignored.
- Browser requests with an `Origin` header are checked against this list.
- Direct server requests without an `Origin` header are not blocked by this list.

When an allowlist exists:

- successful browser responses echo the matched origin in
  `Access-Control-Allow-Origin`
- disallowed browser origins do not receive a permissive CORS header
- `OPTIONS` preflight requests follow the same allowlist rules
- browser clients can send `Idempotency-Key` because the submission endpoint
  exposes it in `Access-Control-Allow-Headers`

## Idempotency-Key

`Idempotency-Key` is optional, but recommended for `fetch()` and direct
server-to-server integrations.

- the key is scoped per form
- the first submission for a `(form_id, idempotency_key)` pair is stored
- later retries with the same key reuse the original submission ID
- duplicate retries do not create a second submission
- duplicate retries do not fire email notifications or webhooks again

JSON clients receive:

- `201 { success: true, id: "<new-submission-id>" }` for the first write
- `200 { success: true, id: "<existing-submission-id>", duplicate: true }` for
  later retries with the same key

HTML form posts cannot attach custom headers, so they cannot use this feature.

## Server token

Each form can optionally issue a **Server Token** for direct server-side
submissions.

- the raw token is shown only once when generated or regenerated
- only the token hash is stored in the database
- browser-origin requests continue to be authorized by the allowlist
- direct requests without an `Origin` header must send either:
  - `Authorization: Bearer <token>`
  - or `x-formzero-token: <token>`

If a token is enabled and a direct request omits it or sends the wrong token:

- JSON clients receive `401 { success: false, error: "Invalid server token" }`
- HTML-style direct submissions are redirected to `/error?error=invalid_server_token`

This separation is intentional: browser integrations should stay origin-based,
while server integrations can be granted explicit token-based access.

## Signed webhooks

Each form can optionally define:

- `webhook_url`
- `webhook_secret`

When both are configured, every successful submission emits one
`submission.created` webhook.

Outgoing headers:

- `X-FormZero-Event: submission.created`
- `X-FormZero-Delivery-Id: <delivery id>`
- `X-FormZero-Timestamp: <ISO timestamp>`
- `X-FormZero-Signature: sha256=<hex-hmac>`

Signature formula:

- `HMAC_SHA256(secret, timestamp + "." + rawBody)`

The webhook payload includes:

- delivery metadata
- form metadata
- submission metadata
- `submission.idempotencyKey`
- `submission.source`
- `submission.origin`

## Delivery log and replay

Every webhook attempt is recorded in `webhook_deliveries`.

Each row tracks:

- delivery ID
- submission ID
- target URL
- attempt number
- request signature and timestamp
- response status / body
- error message when the request fails
- replay linkage via `replayed_from_delivery_id`

The integration screen shows the latest 20 deliveries and allows replaying any
previous delivery.

Replay behavior:

- reuses the original submission data
- creates a brand new delivery-log row
- links the new row back to the original delivery
- signs the replay with the form's **current** webhook URL and secret

This makes it possible to fix an endpoint, regenerate credentials, and then
replay missed deliveries without creating duplicate submissions.

## UI expectations

The integration screen must:

- explain when to translate visible copy for the live site language
- expose copy affordances for the endpoint, code snippets, and server token
- validate allowlist entries while the user types
- keep webhook URL / secret validation explicit before save
- show whether a server token is currently active
- show recent webhook delivery outcomes and allow replay
- keep save feedback explicit for success and failure states
