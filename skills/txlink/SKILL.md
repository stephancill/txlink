---
name: txlink
description: Use https://txlink.stupidtech.net to have a user execute a wallet action with their own wallet via a shareable URL. Use when an agent needs the user to approve/execute a JSON-RPC request (e.g. eth_sendTransaction, personal_sign, eth_signTypedData_v4, wallet_sendCalls), either as a direct link or as a stored request that can be polled for the result.
---

# txlink (txlink.stupidtech.net)

txlink creates user-opened wallet approval pages for JSON-RPC wallet requests.

Use either flow:

- Direct link: fastest for simple requests when the user can copy/paste the result back.
- Stored request API: best when an agent needs to poll for the result automatically.

The page shows the request, prompts the user to connect their wallet, switches to the requested chainId, executes the JSON-RPC request, and shows or stores the result.

## Direct Links

Base URL:

```text
https://txlink.stupidtech.net/
```

Query params:

- `method`: JSON-RPC method name.
- `chainId`: integer chain id to execute on.
- `params`: URL-encoded JSON, either an object or an array.

If `params` is a JSON array, it is treated as the exact JSON-RPC `params` array. If `params` is a JSON object, the app maps common method shapes and fills `from` from the connected wallet when possible.

After execution, the page shows a copyable response or error. Ask the user to send back the tx hash, signature, or JSON response.

### Direct personal_sign

```text
https://txlink.stupidtech.net/?method=personal_sign&chainId=1&params=%7B%22message%22%3A%22hello%22%7D
```

Expected result: signature string.

### Direct eth_sendTransaction

```text
https://txlink.stupidtech.net/?method=eth_sendTransaction&chainId=8453&params=%7B%22to%22%3A%220x8d25687829D6b85d9e0020B8c89e3Ca24dE20a89%22%2C%22value%22%3A%220x0%22%7D
```

Expected result: tx hash.

## Stored Request API

Create a stored request when you want the result to be available by polling instead of asking the user to paste it back.

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

Stored requests verify that the connected wallet matches `address` before execution.

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
- For `eth_sendTransaction`, use `{ to, data?, value? }`; `from` may be omitted.
- For `personal_sign`, use `{ message }` or `{ data }`; `address` may be omitted.
- For `eth_signTypedData_v4`, use `{ typedData }` or `{ data }`; `address` may be omitted.
- For `wallet_sendCalls`, use `{ calls: [{ to, data, value? }, ...] }`; `from` may be omitted.

## Safety Checks

- Always show the user what the request does in plain language before asking them to open the link.
- Prefer least-privilege requests; avoid requesting permissions you do not need.
- Use the stored request API when polling is important; use direct links when a manual user response is acceptable.
