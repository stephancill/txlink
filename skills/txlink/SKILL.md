---
name: txlink
description: Use https://txlink.stupidtech.net to have a user execute a wallet action with their own wallet via a shareable URL. Use when an agent needs the user to approve/execute a JSON-RPC request (e.g. eth_sendTransaction, personal_sign, eth_signTypedData_v4, wallet_sendCalls) and poll for the stored result.
---

# txlink (txlink.stupidtech.net)

Create a stored wallet request through the API, send the returned URL to the user, then poll the returned status URL until the wallet result is available.

The page shows the request, prompts the user to connect their wallet, verifies the connected wallet matches the requested address, switches to the requested chainId, executes the JSON-RPC request, and stores the result or error.

## Create The Request

Endpoint:

```http
POST https://txlink.stupidtech.net/api/requests
content-type: application/json
```

Body:

```json
{
  "address": "0xUserAddress",
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

Send `url` to the user. Keep `statusUrl` so you can poll for completion. The URL includes a private completion token, so do not post it publicly unless the user approval link itself is intended to be public.

## Poll For Completion

Endpoint:

```http
GET https://txlink.stupidtech.net/api/requests/tx_...
```

Pending:

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

Completed:

```json
{
  "id": "tx_...",
  "status": "completed",
  "resultType": "string",
  "result": "0xTransactionHash"
}
```

Failed:

```json
{
  "id": "tx_...",
  "status": "failed",
  "error": "User rejected the request."
}
```

Records expire after 7 days.

## Params Format

- If `params` is a JSON array, it is treated as the exact JSON-RPC `params` array.
- If `params` is a JSON object, the app maps common method shapes and fills `from` from the connected wallet when possible.
- For `eth_sendTransaction`, use `{ to, data, value? }`; `from` may be omitted.
- For `personal_sign`, use `{ message }` or `{ data }`; `address` may be omitted because the stored request already specifies the wallet address.
- For `eth_signTypedData_v4`, use `{ typedData }` or `{ data }`; `address` may be omitted.
- For `wallet_sendCalls`, use `{ calls: [{ to, data, value? }, ...] }`; `from` may be omitted.

## Common Flows

### Sign A Message

```json
{
  "address": "0xUserAddress",
  "method": "personal_sign",
  "chainId": 1,
  "params": {
    "message": "hello"
  }
}
```

Expected result: signature string.

### Send A Transaction

```json
{
  "address": "0xUserAddress",
  "method": "eth_sendTransaction",
  "chainId": 1,
  "params": {
    "to": "0x4c5Ce72478D6Ce160cb31Dd25fe6a15DC269592D",
    "data": "0xd09de08a"
  }
}
```

Expected result: tx hash.

## Legacy Direct Links

Direct links with `method`, `chainId`, and `params` still work for manual use, but agents should use the stored request API. `redirect_url` is no longer supported.

## Safety Checks

- Always show the user what the request does in plain language before asking them to open the link.
- Prefer least-privilege requests; avoid requesting permissions you do not need.
- Poll by `statusUrl`; do not ask the user to paste back a tx hash unless the API is unavailable.
