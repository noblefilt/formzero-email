# FormZero MCP Server

This is a read-only `stdio` MCP server for Hermes or any other MCP client.

It reads from a live FormZero instance through dedicated `/api/mcp/*` endpoints
and is designed for inquiry analysis, not operational control.

## What It Can Read

- forms with unread / submission / spam counts
- per-form submission lists
- individual submission content
- spam lists
- safe global notification settings

## What It Cannot Do

- delete or restore submissions
- change notification settings
- create, rename, or delete forms
- access SMTP passwords, webhook secrets, or server tokens

## Required Environment Variables

- `FORMZERO_BASE_URL`
  Example: `https://formzero.your-domain.workers.dev`
- `FORMZERO_MCP_TOKEN`
  This must match the `FORMZERO_MCP_TOKEN` secret configured on the FormZero app.

## Build

From the repository root:

```bash
npm run mcp:build
```

## Run

From the repository root:

```bash
FORMZERO_BASE_URL="https://formzero.your-domain.workers.dev" \
FORMZERO_MCP_TOKEN="replace-me" \
npm run mcp:start
```

## Hermes Example

Use the built entrypoint as a `stdio` MCP command:

```json
{
  "mcpServers": {
    "formzero": {
      "command": "node",
      "args": [
        "/Users/yc/Downloads/formzero-main/mcp/formzero-mcp-server/dist/index.js"
      ],
      "env": {
        "FORMZERO_BASE_URL": "https://formzero.your-domain.workers.dev",
        "FORMZERO_MCP_TOKEN": "replace-me"
      }
    }
  }
}
```

## Deploy-Side Secret

Set the matching secret on the FormZero app before using the MCP server:

```bash
wrangler secret put FORMZERO_MCP_TOKEN
```
