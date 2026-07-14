import { z } from "zod";

type D1Result<T = unknown> = {
  results?: T[];
  success: boolean;
  error?: string;
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  TXLINK_DB: D1Database;
};

type RequestRow = {
  id: string;
  address: string;
  method: string;
  chain_id: number;
  params_json: string;
  status: "pending" | "completed" | "failed";
  result_type: string | null;
  result_json: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  expires_at: string;
};

const retentionMs = 7 * 24 * 60 * 60 * 1_000;
const idBytes = 16;
const tokenBytes = 32;
const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);
const createRequestSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  method: z.string().trim().min(1).max(128),
  chainId: z.number().int().positive().safe(),
  params: z.union([z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
});
const completeRequestSchema = z
  .object({
    completionToken: z.string().min(1),
    resultType: z.enum(["string", "json"]).optional(),
    result: jsonValueSchema.optional(),
    error: z.string().optional(),
  })
  .refine((value) => (value.result === undefined) !== (value.error === undefined), {
    message: "Provide exactly one of result or error.",
  });

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...init?.headers,
    },
  });
}

function randomUrlSafe(bytes: number) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  let binary = "";
  for (const value of values) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toIso(date: Date) {
  return date.toISOString();
}

function baseUrl(request: Request) {
  const url = new URL(request.url);
  return url.origin;
}

function serializeRow(row: RequestRow, includeRequest = true) {
  return {
    id: row.id,
    ...(includeRequest
      ? {
          address: row.address,
          method: row.method,
          chainId: row.chain_id,
          params: JSON.parse(row.params_json) as unknown,
        }
      : {}),
    status: row.status,
    ...(row.status === "completed"
      ? {
          resultType: row.result_type,
          result: row.result_json ? (JSON.parse(row.result_json) as unknown) : null,
        }
      : {}),
    ...(row.status === "failed" ? { error: row.error } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
  };
}

async function createStoredRequest(request: Request, env: Env) {
  const parsed = createRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: "Invalid request body", issues: parsed.error.issues }, { status: 400 });
  }

  const id = `tx_${randomUrlSafe(idBytes)}`;
  const completionToken = randomUrlSafe(tokenBytes);
  const now = new Date();
  const createdAt = toIso(now);
  const expiresAt = toIso(new Date(now.getTime() + retentionMs));
  const tokenHash = await sha256(completionToken);
  const body = parsed.data;

  const result = await env.TXLINK_DB.prepare(
    `INSERT INTO requests (
      id, address, method, chain_id, params_json, status, completion_token_hash,
      created_at, updated_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.address.toLowerCase(),
      body.method,
      body.chainId,
      JSON.stringify(body.params),
      tokenHash,
      createdAt,
      createdAt,
      expiresAt,
    )
    .run();

  if (!result.success)
    return json({ error: result.error ?? "Failed to store request" }, { status: 500 });

  const origin = baseUrl(request);
  return json(
    {
      id,
      url: `${origin}/?id=${encodeURIComponent(id)}&token=${encodeURIComponent(completionToken)}`,
      statusUrl: `${origin}/api/requests/${encodeURIComponent(id)}`,
      expiresAt,
    },
    { status: 201 },
  );
}

async function getStoredRequest(id: string, env: Env) {
  const row = await env.TXLINK_DB.prepare(
    `SELECT id, address, method, chain_id, params_json, status, result_type, result_json,
      error, created_at, updated_at, completed_at, expires_at
    FROM requests WHERE id = ? AND expires_at > ?`,
  )
    .bind(id, toIso(new Date()))
    .first<RequestRow>();

  if (!row) return json({ error: "Request not found" }, { status: 404 });
  return json(serializeRow(row));
}

async function completeStoredRequest(id: string, request: Request, env: Env) {
  const parsed = completeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: "Invalid request body", issues: parsed.error.issues }, { status: 400 });
  }

  const row = await env.TXLINK_DB.prepare(
    `SELECT id, status, completion_token_hash, expires_at FROM requests WHERE id = ? AND expires_at > ?`,
  )
    .bind(id, toIso(new Date()))
    .first<Pick<RequestRow, "id" | "status" | "expires_at"> & { completion_token_hash: string }>();

  if (!row) return json({ error: "Request not found" }, { status: 404 });
  if (row.status !== "pending")
    return json({ error: "Request already completed" }, { status: 409 });

  const tokenHash = await sha256(parsed.data.completionToken);
  if (tokenHash !== row.completion_token_hash)
    return json({ error: "Invalid completion token" }, { status: 403 });

  const now = toIso(new Date());
  const status = parsed.data.error === undefined ? "completed" : "failed";
  const resultType =
    parsed.data.result === undefined
      ? null
      : (parsed.data.resultType ?? (typeof parsed.data.result === "string" ? "string" : "json"));
  const resultJson = parsed.data.result === undefined ? null : JSON.stringify(parsed.data.result);
  const error = parsed.data.error ?? null;

  const result = await env.TXLINK_DB.prepare(
    `UPDATE requests
    SET status = ?, result_type = ?, result_json = ?, error = ?, updated_at = ?, completed_at = ?
    WHERE id = ? AND status = 'pending'`,
  )
    .bind(status, resultType, resultJson, error, now, now, id)
    .run();

  if (!result.success)
    return json({ error: result.error ?? "Failed to complete request" }, { status: 500 });
  return json({ id, status, updatedAt: now, completedAt: now });
}

async function routeApi(request: Request, env: Env) {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(request.url);
  if (url.pathname === "/api/requests" && request.method === "POST") {
    return createStoredRequest(request, env);
  }

  const match = url.pathname.match(/^\/api\/requests\/([^/]+)(?:\/(complete))?$/);
  if (!match) return json({ error: "Not found" }, { status: 404 });

  const id = decodeURIComponent(match[1]);
  const action = match[2];
  if (!/^tx_[A-Za-z0-9_-]+$/.test(id))
    return json({ error: "Invalid request id" }, { status: 400 });

  if (!action && request.method === "GET") return getStoredRequest(id, env);
  if (action === "complete" && request.method === "POST")
    return completeStoredRequest(id, request, env);

  return json({ error: "Method not allowed" }, { status: 405 });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return routeApi(request, env);
    return env.ASSETS.fetch(request);
  },
};
