txlink is a tiny page and API for sharing wallet requests with users.

Agents create a stored JSON-RPC request, send the returned approval URL to the user, and poll the request status until the wallet result is stored.

Direct URL requests with `method`, `chainId`, and `params` still work for manual use, but `redirect_url` is no longer supported.

## Deployed

- `https://txlink.stupidtech.net`

## Stored Request API

### Create a request

```http
POST https://txlink.stupidtech.net/api/requests
content-type: application/json
```

```json
{
  "address": "0x0000000000000000000000000000000000000000",
  "method": "eth_sendTransaction",
  "chainId": 1,
  "params": {
    "to": "0x4c5Ce72478D6Ce160cb31Dd25fe6a15DC269592D",
    "data": "0xd09de08a"
  }
}
```

Response:

```json
{
  "id": "tx_...",
  "url": "https://txlink.stupidtech.net/?id=tx_...&token=...",
  "statusUrl": "https://txlink.stupidtech.net/api/requests/tx_...",
  "expiresAt": "..."
}
```

Send `url` to the user. The `token` in that URL is private and lets the frontend write the wallet result back to the stored request.

### Poll for the result

```http
GET https://txlink.stupidtech.net/api/requests/tx_...
```

Pending response:

```json
{
  "id": "tx_...",
  "address": "0x...",
  "method": "eth_sendTransaction",
  "chainId": 1,
  "params": {},
  "status": "pending",
  "createdAt": "...",
  "updatedAt": "...",
  "completedAt": null,
  "expiresAt": "..."
}
```

Completed response:

```json
{
  "id": "tx_...",
  "status": "completed",
  "resultType": "string",
  "result": "0x..."
}
```

Failed response:

```json
{
  "id": "tx_...",
  "status": "failed",
  "error": "User rejected the request."
}
```

Records expire after 7 days.

## Direct URL Format

Required query params:

- `method`: JSON-RPC method (e.g. `eth_sendTransaction`, `personal_sign`, `eth_signTypedData_v4`, `wallet_sendCalls`)
- `chainId`: integer chain id (the app will attempt to switch chains before executing)
- `params`: URL-encoded JSON (either an object or an array)

Direct URLs show a copyable result after execution. Use the stored request API when an agent needs to retrieve the result automatically.

## Examples

### personal_sign

```text
https://txlink.stupidtech.net/?method=personal_sign&chainId=1&params=%7B%22message%22%3A%22hello%22%7D
```

### eth_sendTransaction

```text
https://txlink.stupidtech.net/?method=eth_sendTransaction&chainId=1&params=%7B%22to%22%3A%220x4c5Ce72478D6Ce160cb31Dd25fe6a15DC269592D%22%2C%22data%22%3A%220xd09de08a%22%7D
```

## Local Dev

```bash
bun install
bun run dev
```

## Build

```bash
bunx oxfmt --write "src/App.tsx" "src/wagmi.ts" "src/worker.ts" "vite.config.ts"
bun run build
```

## D1 Setup

Create the production database, replace the placeholder `database_id` in `wrangler.jsonc`, then apply migrations:

```bash
wrangler d1 create txlink
wrangler d1 migrations apply txlink --remote
```

## Deploy

Deployment uses Cloudflare Workers Static Assets via `wrangler.jsonc`.

```bash
source "$HOME/.nvm/nvm.sh" && nvm use 22
bun run deploy
```

Expected custom domain route:

```text
txlink.stupidtech.net (custom domain)
```

## Agent Skill

See `skills/txlink/SKILL.md` for the source agent-facing usage guide.

The same file is hosted at:

```text
https://txlink.stupidtech.net/SKILL.md
```

Keep `skills/txlink/SKILL.md` and `public/SKILL.md` in sync.
