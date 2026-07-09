import {
  type DisplayField,
  type DisplayFieldGroup,
  type DisplayModel,
  type ExternalDataProvider,
  type RegistryIndex,
  type TrustedTokens,
  fetchPrebuiltRegistryIndex,
  format as formatClearSigning,
  isFieldGroup,
} from "@ethereum-sourcify/clear-signing";
import { whatsabi } from "@shazow/whatsabi";
import { useMutation, useQuery } from "@tanstack/react-query";
import { blo } from "blo";
import { createParser, parseAsInteger, useQueryState } from "nuqs";
import * as React from "react";
import {
  type Abi,
  createPublicClient,
  decodeFunctionData,
  erc20Abi,
  type Hex,
  hexToString,
  http,
  isAddress,
  isHex,
  stringToHex,
} from "viem";
import { mainnet } from "viem/chains";
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { config } from "./wagmi";

type JsonObject = Record<string, unknown>;

type CalldataTarget = {
  to: string;
  data: Hex;
  from?: string;
  value?: bigint;
};

const ensClient = createPublicClient({
  chain: mainnet,
  transport: http("https://evm.stupidtech.net/v1/1", { timeout: 5_000 }),
});

const clearSigningSamples = [
  {
    name: "USDC Transfer",
    description: "Send USDC stablecoin to another address",
    params: {
      to: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      data: "0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa9604500000000000000000000000000000000000000000000000000000000000003e8",
    },
  },
  {
    name: "Uniswap V3 Swap",
    description: "Token swap on the Uniswap V3 SwapRouter02",
    params: {
      to: "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
      data: "0x04e45aaf000000000000000000000000e73d53e3a982ab2750a0b76f9012e18b256cc243000000000000000000000000955d5c14c8d4944da1ea7836bd44d54a8ec35ba10000000000000000000000000000000000000000000000000000000000002710000000000000000000000000a22f1ac02b5fc04f2e355c30aebfd82a7465b2500000000000000000000000000000000000000000000000a2a15d09519be000000000000000000000000000000000000000000000000e47e1f99bfc71ff5996f80000000000000000000000000000000000000000000000000000000000000000",
    },
  },
  {
    name: "Lido stETH Submit",
    description: "Stake ETH via Lido to receive stETH",
    params: {
      to: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
      data: "0xa1903eab0000000000000000000000006dc9657c2d90d57cadffb64239242d06e6103e43",
      value: "0x63addbd635abd1a",
    },
  },
  {
    name: "Aave V3 Supply",
    description: "Supply assets to the Aave V3 lending pool",
    params: {
      to: "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2",
      data: "0x617ba037000000000000000000000000cd5fe23c85820f7b72d0926fc9b05b43e359b7ee0000000000000000000000000000000000000000000000002e6eb7bdd84f244b0000000000000000000000007221b104fba7701084759fd25faca19ac63008550000000000000000000000000000000000000000000000000000000000000000",
    },
  },
  {
    name: "WETH Deposit",
    description: "Wrap ETH into WETH",
    params: {
      to: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      data: "0xd0e30db0",
      value: "0x440aa47cbd000",
    },
  },
  {
    name: "1inch Swap",
    description: "Token swap via 1inch Aggregation Router V6",
    params: {
      to: "0x111111125421ca6dc452d289314280a0f8842a65",
      data: "0x07ed2379000000000000000000000000990636ecb3ff04d33d92e970d3d588bf5cd8d086000000000000000000000000e6264d3cc0948675e81e59d0fa2fd8e19cebf1f0000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000990636ecb3ff04d33d92e970d3d588bf5cd8d086000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa9604500000000000000000000000000000000000018a6e32246c99c60ad85000000000000000000000000000000000000000000000000000000004ddc0a99119f757b00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000018300000000000000000000000000000000016500014f0001050000c900004e00a0744c8c09e6264d3cc0948675e81e59d0fa2fd8e19cebf1f0cfd59c0f530db36eea8ccbfe744f01fe3556925e00000000000000000000000000000000000000327cb2734119d3b7a9000000000c20e6264d3cc0948675e81e59d0fa2fd8e19cebf1f077949cad6f504bbb59886423127d17687babccbf6ae4071118002dc6c077949cad6f504bbb59886423127d17687babccbf0000000000000000000000000000000000000000000000004d77e160fbaa3c49e6264d3cc0948675e81e59d0fa2fd8e19cebf1f04101c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200042e1a7d4d000000000000000000000000000000000000000000000000000000000000000000a0f2fa6b66eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000000000000000000000000000004e4033d12794aead00000000000000000005f7744d630968c061111111125421ca6dc452d289314280a0f8842a6500000000000000000000000000000000000000000000000000000000006963f2b1",
    },
  },
  {
    name: "Aave V3 Borrow",
    description: "Borrow assets from the Aave V3 lending pool",
    params: {
      to: "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2",
      data: "0xa415bcad000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7000000000000000000000000000000000000000000000000000000006553f100000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b964f15f863d00cd4819ca0e774f7af8c5200fe",
    },
  },
  {
    name: "Safe Factory",
    description: "Deploy a new Safe multisig wallet via SafeProxyFactory",
    params: {
      to: "0x14f2982d601c9458f93bd70b218933a6f8165e7b",
      data: "0x1688f0b9000000000000000000000000ff51a5898e281db6dfc7855790607438df2ca44b000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000847924ad0e10568fa37f43eac0d2edfb0000000000000000000000000000000000000000000000000000000000000184b63e800d000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000bce5d9f94a897eac31cc0b039906ece65e263aac000000000000000000000000be0b407782a7599380fa726db315340126d62229000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    },
  },
] satisfies Array<{
  name: string;
  description: string;
  params: { to: string; data: string; value?: string };
}>;

let clearSigningRegistryIndexPromise: Promise<RegistryIndex> | null = null;

function getClearSigningRegistryIndex() {
  clearSigningRegistryIndexPromise ??= fetchPrebuiltRegistryIndex();
  return clearSigningRegistryIndexPromise;
}

type AbiInput = {
  name?: string;
  type?: string;
  internalType?: string;
  components?: AbiInput[];
};

type SourcifyV2Contract = {
  abi?: unknown;
  compilation?: {
    name?: unknown;
  };
  match?: unknown;
};

function createSourcifyV2AbiLoader(chainId: number) {
  const loader = {
    name: "SourcifyV2ABILoader",
    async getContract(address: string) {
      const url = new URL(`https://sourcify.dev/server/v2/contract/${chainId}/${address}`);
      url.searchParams.set("fields", "abi,compilation");

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Sourcify v2 ${response.status}: ${response.statusText}`);
      }

      const result = (await response.json()) as SourcifyV2Contract;
      if (!Array.isArray(result.abi)) {
        throw new Error("Sourcify v2 response did not include an ABI");
      }

      return {
        abi: result.abi,
        name: typeof result.compilation?.name === "string" ? result.compilation.name : null,
        ok: result.match === "match" || result.match === "exact_match",
        loader,
        loaderResult: result,
      };
    },
    async loadABI(address: string) {
      return (await loader.getContract(address)).abi;
    },
  };

  return loader;
}

function alertClass(destructive = false) {
  return destructive ? "text-red-700" : "text-gray-700";
}

function safeJsonStringify(value: unknown, space?: number) {
  return JSON.stringify(
    value,
    (_, v) => {
      if (typeof v === "bigint") return v.toString();
      return v;
    },
    space,
  );
}

function buildRequestPath({
  method,
  chainId,
  params,
}: {
  method: string;
  chainId: number;
  params: unknown;
}) {
  const searchParams = new URLSearchParams({
    method,
    chainId: String(chainId),
    params: JSON.stringify(params),
  });

  return `/?${searchParams.toString()}`;
}

function decodePersonalSignMessage(value: unknown) {
  if (typeof value !== "string") return null;
  if (!isHex(value)) return value;

  try {
    return hexToString(value);
  } catch {
    return value;
  }
}

function getPersonalSignPreview(rawParams: unknown) {
  if (Array.isArray(rawParams)) {
    return {
      message: decodePersonalSignMessage(rawParams[0]),
      address: typeof rawParams[1] === "string" ? rawParams[1] : null,
    };
  }

  if (!isJsonObject(rawParams)) {
    return { message: null, address: null };
  }

  return {
    message: decodePersonalSignMessage(rawParams.message ?? rawParams.data),
    address: typeof rawParams.address === "string" ? rawParams.address : null,
  };
}

const parseAsUnsafeJson = createParser({
  parse: (query: string) => {
    const maybeDecodeOnce = (value: string) => {
      if (!value.includes("%")) return value;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };

    const candidates = [query, maybeDecodeOnce(query), maybeDecodeOnce(maybeDecodeOnce(query))];

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate) as unknown;
      } catch {
        // keep trying
      }
    }

    return null;
  },
  serialize: (value: unknown) => JSON.stringify(value),
});

function normalizeRedirectUrl(input: string) {
  const maybeDecodeOnce = (value: string) => {
    if (!value.includes("%")) return value;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  let out = input;
  for (let i = 0; i < 2; i += 1) {
    const decoded = maybeDecodeOnce(out);
    if (decoded === out) break;
    out = decoded;
  }

  return out;
}

function collectAddresses(value: unknown, out: Set<string>) {
  if (typeof value === "string") {
    if (isAddress(value)) out.add(value.toLowerCase());
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectAddresses(item, out);
    return;
  }

  if (isJsonObject(value)) {
    for (const item of Object.values(value)) collectAddresses(item, out);
  }
}

function parseOptionalBigInt(value: unknown) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return BigInt(value);
  if (typeof value !== "string" || value.trim().length === 0) return undefined;

  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function hasClearSigningDisplay(model: DisplayModel) {
  return (
    !model.rawCalldataFallback &&
    (model.interpolatedIntent != null ||
      model.intent != null ||
      (Array.isArray(model.fields) && model.fields.length > 0))
  );
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildRpcParams(
  method: string,
  rawParams: unknown,
  fallbackAddress: string | undefined,
): { ok: true; params: unknown[] } | { ok: false; error: string } {
  if (!method) {
    return { ok: false, error: "Missing `method` query param." };
  }

  if (rawParams == null) {
    return {
      ok: false,
      error: "Missing or invalid `params` query param (expected JSON).",
    };
  }

  // Let advanced callers pass the exact JSON-RPC params array.
  if (Array.isArray(rawParams)) {
    return { ok: true, params: rawParams };
  }

  if (!isJsonObject(rawParams)) {
    return {
      ok: false,
      error: "`params` must be a JSON object or JSON array.",
    };
  }

  // Convenience mapping for common wallet methods.
  if (method === "eth_sendTransaction") {
    const tx = { ...rawParams };
    const from = (tx.from as string | undefined) ?? fallbackAddress;
    // Some wallets/providers require `from`, but we can still show/validate the
    // request before a wallet is connected. Once connected, we will fill it.
    return { ok: true, params: [from ? { ...tx, from } : tx] };
  }

  if (method === "wallet_sendCalls") {
    const calls = { ...rawParams };
    const from = (calls.from as string | undefined) ?? fallbackAddress;
    return { ok: true, params: [from ? { ...calls, from } : calls] };
  }

  if (method === "personal_sign") {
    const message = rawParams.message ?? rawParams.data;
    const address = (rawParams.address as string | undefined) ?? fallbackAddress;

    if (!address) {
      return {
        ok: false,
        error: "personal_sign needs an address (either in params.address or via connected wallet).",
      };
    }

    if (typeof message !== "string") {
      return {
        ok: false,
        error: "personal_sign needs `params.message` (or `params.data`) as a string.",
      };
    }

    const data = message.startsWith("0x") ? message : stringToHex(message);
    return { ok: true, params: [data, address] };
  }

  if (method === "eth_signTypedData_v4") {
    const address = (rawParams.address as string | undefined) ?? fallbackAddress;
    const typedData = rawParams.typedData ?? rawParams.data;

    if (!address) {
      return {
        ok: false,
        error:
          "eth_signTypedData_v4 needs an address (either in params.address or via connected wallet).",
      };
    }

    if (typedData == null) {
      return {
        ok: false,
        error: "eth_signTypedData_v4 needs `params.typedData` (or `params.data`).",
      };
    }

    const typedDataJson = typeof typedData === "string" ? typedData : JSON.stringify(typedData);
    return { ok: true, params: [address, typedDataJson] };
  }

  // Generic fallback: treat the provided params object as the first param.
  return { ok: true, params: [rawParams] };
}

type DecodedCall =
  | {
      ok: true;
      to: string;
      data: Hex;
      decoded: {
        functionName: string;
        args?: unknown;
        inputs?: AbiInput[];
      };
      resolvedAddress?: string;
      contractName?: string;
      tokenLabel?: string;
      clearSigning?: DisplayModel;
    }
  | {
      ok: false;
      to?: string;
      data?: string;
      error: string;
      selector?: string;
      possibleSignatures?: string[];
    };

function extractCalldataTargets(method: string | null, rpcParams: unknown[] | null) {
  if (!method || !rpcParams || rpcParams.length === 0) return [] as CalldataTarget[];

  const first = rpcParams[0];
  if (!first || typeof first !== "object") return [];

  if (method === "eth_sendTransaction") {
    const tx = first as Record<string, unknown>;
    const to = tx.to;
    const data = (tx.data ?? tx.input) as unknown;
    if (typeof to === "string" && typeof data === "string" && isHex(data) && data !== "0x") {
      const from = typeof tx.from === "string" ? tx.from : undefined;
      return [{ to, data: data as Hex, from, value: parseOptionalBigInt(tx.value) }];
    }
  }

  if (method === "wallet_sendCalls") {
    const obj = first as Record<string, unknown>;
    const calls = obj.calls;
    if (Array.isArray(calls)) {
      const out: CalldataTarget[] = [];
      for (const call of calls) {
        if (!call || typeof call !== "object") continue;
        const c = call as Record<string, unknown>;
        const to = c.to;
        const data = (c.data ?? c.callData) as unknown;
        if (typeof to === "string" && typeof data === "string" && isHex(data) && data !== "0x") {
          out.push({ to, data: data as Hex, value: parseOptionalBigInt(c.value) });
        }
      }
      return out;
    }
  }

  return [];
}

function formatAbiType(input: AbiInput | undefined) {
  const t = input?.type;
  const it = input?.internalType;
  if (t === "tuple" || (typeof t === "string" && t.startsWith("tuple"))) {
    if (typeof it === "string" && it.startsWith("struct ")) {
      const structPath = it.replace(/^struct\s+/, "").trim();
      const name = structPath.split(".").pop();
      return name ? `tuple ${name}` : "tuple";
    }
    return "tuple";
  }
  if (typeof it === "string" && it.length > 0) return it;
  return typeof t === "string" ? t : "unknown";
}

function formatBase18Significant(value: bigint) {
  if (value === 0n) return "0 x10¹⁸";

  const sign = value < 0n ? "-" : "";
  const raw = (value < 0n ? -value : value).toString();
  const padded = raw.padStart(19, "0");
  const whole = padded.slice(0, -18).replace(/^0+(?=\d)/, "");
  const fraction = padded.slice(-18);
  const decimal = `${whole}.${fraction}`;
  const firstSignificant = decimal.search(/[1-9]/);

  if (firstSignificant === -1) return "0 x10¹⁸";

  let significantSeen = 0;
  let coefficient = "";
  for (const char of decimal) {
    if (char === ".") {
      coefficient += char;
      continue;
    }

    if (significantSeen > 0 || char !== "0") significantSeen += 1;
    coefficient += char;
    if (significantSeen >= 6) break;
  }

  coefficient = coefficient.replace(/\.0*$/, "").replace(/(\.\d*?)0+$/, "$1");
  return `${sign}${coefficient} x10¹⁸`;
}

function App() {
  const connection = useConnection();
  const { connect, error } = useConnect();
  const connectors = useConnectors();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const [method] = useQueryState("method");
  const [requestedChainId] = useQueryState("chainId", parseAsInteger);
  const [rawParams] = useQueryState("params", parseAsUnsafeJson);
  const [redirectUrl] = useQueryState("redirect_url");
  const hasRequestQuery = React.useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.has("method") || searchParams.has("chainId") || searchParams.has("params");
  }, [method, requestedChainId, rawParams]);
  const sampleSignPath = React.useMemo(
    () =>
      buildRequestPath({
        method: "personal_sign",
        chainId: 1,
        params: { message: "Hello world" },
      }),
    [],
  );
  const clearSigningSamplePaths = React.useMemo(
    () =>
      clearSigningSamples.map((sample) => ({
        ...sample,
        path: buildRequestPath({
          method: "eth_sendTransaction",
          chainId: 1,
          params: sample.params,
        }),
      })),
    [],
  );
  const normalizedRedirectUrl = React.useMemo(() => {
    if (!redirectUrl) return null;
    const normalized = normalizeRedirectUrl(redirectUrl).trim();
    return normalized.length > 0 ? normalized : null;
  }, [redirectUrl]);

  const connectedAddress = connection.addresses?.[0];
  const built = React.useMemo(
    () => buildRpcParams(method ?? "", rawParams, connectedAddress),
    [method, rawParams, connectedAddress],
  );
  const builtOk = built.ok;
  const rpcParams = builtOk ? built.params : null;
  const personalSignPreview = React.useMemo(
    () => (method === "personal_sign" ? getPersonalSignPreview(rawParams) : null),
    [method, rawParams],
  );

  const calldataTargets = React.useMemo(
    () => extractCalldataTargets(method, rpcParams),
    [method, rpcParams],
  );
  const calldataTargetsKey = React.useMemo(
    () =>
      calldataTargets.map((target) => ({
        to: target.to,
        data: target.data,
        from: target.from,
        value: target.value?.toString(),
      })),
    [calldataTargets],
  );

  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);
  const [rawAddressDisplays, setRawAddressDisplays] = React.useState<Set<string>>(() => new Set());

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "true");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  }

  function buildRedirectTarget(input: string, payload: { result?: unknown; error?: string }) {
    const stringifyResult = (value: unknown) => {
      if (typeof value === "string") return { resultType: "string", result: value };
      return { resultType: "json", result: safeJsonStringify(value) };
    };

    // Template mode: if redirect_url contains `{{...}}`, replace placeholders instead
    // of appending `?result=...` style query params.
    //
    // Placeholders:
    // - {{result}} / {{error}} are URL-encoded
    // - {{result_raw}} / {{error_raw}} are unencoded
    // - {{resultType}} is `string` or `json`
    if (input.includes("{{")) {
      const replaceAll = (source: string, search: string, replacement: string) =>
        source.split(search).join(replacement);

      const res = payload.result !== undefined ? stringifyResult(payload.result) : null;
      const error = payload.error ?? "";
      let out = input;
      out = replaceAll(out, "{{resultType}}", res?.resultType ?? "");
      out = replaceAll(out, "{{result_raw}}", res?.result ?? "");
      out = replaceAll(out, "{{error_raw}}", error);
      out = replaceAll(out, "{{result}}", res ? encodeURIComponent(res.result) : "");
      out = replaceAll(out, "{{error}}", error ? encodeURIComponent(error) : "");

      const url = new URL(out, window.location.origin);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(`Unsupported redirect_url protocol: ${url.protocol}`);
      }
      return url.toString();
    }

    // Default mode: append result/error as query params.
    const base = new URL(input, window.location.origin);
    if (base.protocol !== "http:" && base.protocol !== "https:") {
      throw new Error(`Unsupported redirect_url protocol: ${base.protocol}`);
    }

    if (payload.error) {
      base.searchParams.set("error", payload.error);
    }

    if (payload.result !== undefined) {
      const res = stringifyResult(payload.result);
      base.searchParams.set("resultType", res.resultType);
      base.searchParams.set("result", res.result);
    }

    return base.toString();
  }

  const chainIdOk =
    requestedChainId != null && Number.isInteger(requestedChainId) && requestedChainId > 0;

  type SupportedChainId = (typeof config.chains)[number]["id"];
  const supportedChainIds = React.useMemo(
    () => config.chains.map((c) => c.id as SupportedChainId),
    [],
  );
  const chainIdSupported =
    chainIdOk && supportedChainIds.includes(requestedChainId as SupportedChainId);
  const requestedChain = React.useMemo(
    () => config.chains.find((c) => c.id === requestedChainId),
    [requestedChainId],
  );

  const publicClient = usePublicClient(
    chainIdSupported ? { chainId: requestedChainId as SupportedChainId } : undefined,
  );

  const isConnected = connection.status === "connected";
  const isPersonalSignWaitingForWalletAddress =
    method === "personal_sign" &&
    !isConnected &&
    !builtOk &&
    built.error.includes("needs an address");

  const requestError = !chainIdOk
    ? "Missing or invalid `chainId` query param (expected integer chain id, e.g. 1, 11155111)."
    : !chainIdSupported
      ? `Unsupported chainId ${requestedChainId}. Supported: ${supportedChainIds.join(", ")}`
      : builtOk
        ? null
        : isPersonalSignWaitingForWalletAddress
          ? null
          : built.error;

  const needsChainSwitch =
    isConnected &&
    requestedChainId != null &&
    connection.chainId != null &&
    connection.chainId !== requestedChainId;

  const chainSwitchMutation = useMutation({
    mutationFn: async (chainId: SupportedChainId) => {
      await switchChainAsync({ chainId });
    },
  });
  const isSwitchingChain = chainSwitchMutation.isPending;
  const chainSwitchError = chainSwitchMutation.error
    ? chainSwitchMutation.error instanceof Error
      ? chainSwitchMutation.error.message
      : String(chainSwitchMutation.error)
    : null;

  const lastAutoSwitchKeyRef = React.useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: auto-switch once per (address, chainId)
  React.useEffect(() => {
    if (!isConnected) return;
    if (!chainIdSupported) return;
    if (!connectedAddress) return;
    if (requestedChainId == null) return;
    if (connection.chainId === requestedChainId) return;

    const key = `${connectedAddress}:${requestedChainId}`;
    if (lastAutoSwitchKeyRef.current === key) return;
    lastAutoSwitchKeyRef.current = key;

    chainSwitchMutation.mutate(requestedChainId as SupportedChainId);
  }, [chainIdSupported, connectedAddress, connection.chainId, isConnected, requestedChainId]);

  const canOpenRequest =
    connection.status === "connected" &&
    walletClient != null &&
    builtOk &&
    chainIdSupported &&
    !needsChainSwitch &&
    !isSwitchingChain;

  const { data: decodedCalls = null, isLoading: isDecoding } = useQuery({
    queryKey: ["decodedCalls", method, requestedChainId, calldataTargetsKey] as const,
    queryFn: async () => {
      if (!publicClient) throw new Error("No public client");

      // Prefer Sourcify v2 for ABI and contract-name metadata.
      const abiLoader = createSourcifyV2AbiLoader(requestedChainId ?? 1);

      const signatureLookup = new whatsabi.loaders.OpenChainSignatureLookup();
      const clearSigningIndex = await getClearSigningRegistryIndex();
      const resolveToken = async (_chainId: number, address: string) => {
        if (!isAddress(address)) return null;

        try {
          const [symbol, name, decimals] = await Promise.all([
            publicClient.readContract({
              address,
              abi: erc20Abi,
              functionName: "symbol",
            }),
            publicClient.readContract({
              address,
              abi: erc20Abi,
              functionName: "name",
            }),
            publicClient.readContract({
              address,
              abi: erc20Abi,
              functionName: "decimals",
            }),
          ]);

          if (
            typeof symbol !== "string" ||
            typeof name !== "string" ||
            typeof decimals !== "number"
          ) {
            return null;
          }

          return { symbol, name, decimals };
        } catch {
          return null;
        }
      };
      const externalDataProvider: ExternalDataProvider = {
        resolveEnsName: async (address) => {
          if (!isAddress(address)) return null;

          try {
            const name = await ensClient.getEnsName({ address });
            return name ? { name, typeMatch: true } : null;
          } catch {
            return null;
          }
        },
        resolveToken,
        resolveChainInfo: async (chainId) => {
          const chain = config.chains.find((c) => c.id === chainId);
          return chain
            ? {
                name: chain.name,
                nativeCurrency: chain.nativeCurrency,
              }
            : null;
        },
      };

      return Promise.all(
        calldataTargets.map(async ({ to, data, from, value }): Promise<DecodedCall> => {
          const selector = data.slice(0, 10);
          let clearSigning: DisplayModel | undefined;
          let clearSigningTokenLabel: string | undefined;

          try {
            const token = await resolveToken(requestedChainId ?? 1, to);
            clearSigningTokenLabel = token?.symbol || token?.name;
            const trustedTokens: TrustedTokens | undefined = token
              ? { [requestedChainId ?? 1]: { [to.toLowerCase()]: "erc20" } }
              : undefined;
            const model = await formatClearSigning(
              {
                chainId: requestedChainId ?? 1,
                to,
                data,
                from,
                value,
              },
              {
                descriptorResolverOptions: {
                  type: "github",
                  index: clearSigningIndex,
                  trustedTokens,
                },
                externalDataProvider,
              },
            );
            if (hasClearSigningDisplay(model)) clearSigning = model;
          } catch {
            // Clear signing is an enhancement; keep the manual calldata decoder as fallback.
          }

          try {
            const r = await whatsabi.autoload(to, {
              provider: publicClient,
              followProxies: true,
              loadContractResult: true,
              abiLoader,
            });

            if (!r.abi) {
              if (clearSigning) {
                return {
                  ok: true,
                  to,
                  data,
                  decoded: { functionName: "", args: [], inputs: [] },
                  contractName: clearSigning.metadata?.contractName,
                  tokenLabel: clearSigningTokenLabel,
                  clearSigning,
                };
              }

              const possibleSignatures = await signatureLookup.loadFunctions(selector);
              return {
                ok: false,
                to,
                data,
                error: "ABI not found",
                selector,
                possibleSignatures: possibleSignatures.slice(0, 5),
              };
            }

            const decodedFn = decodeFunctionData({
              abi: r.abi as Abi,
              data,
            });

            const toAbiInput = (inp: any): AbiInput => {
              const out: AbiInput = {
                name: typeof inp?.name === "string" ? inp.name : undefined,
                type: typeof inp?.type === "string" ? inp.type : undefined,
                internalType: typeof inp?.internalType === "string" ? inp.internalType : undefined,
              };
              if (Array.isArray(inp?.components)) {
                out.components = inp.components.map(toAbiInput);
              }
              return out;
            };

            let inputs: AbiInput[] | undefined;
            try {
              const abiArray = r.abi as unknown as Array<any>;
              const candidates = abiArray.filter(
                (item) => item?.type === "function" && item?.name === decodedFn.functionName,
              );
              const argCount = Array.isArray(decodedFn.args) ? decodedFn.args.length : 0;
              const exact = candidates.find((item) => (item?.inputs?.length || 0) === argCount);
              const fnItem = exact || candidates[0];
              if (fnItem?.inputs && Array.isArray(fnItem.inputs)) {
                inputs = fnItem.inputs.map(toAbiInput);
              }
            } catch {
              // ignore
            }

            let tokenLabel: string | undefined;
            if (isAddress(to)) {
              try {
                const [symbol, name] = await Promise.all([
                  publicClient.readContract({
                    address: to,
                    abi: erc20Abi,
                    functionName: "symbol",
                  }),
                  publicClient.readContract({
                    address: to,
                    abi: erc20Abi,
                    functionName: "name",
                  }),
                ]);
                tokenLabel =
                  typeof symbol === "string" && symbol.length > 0
                    ? symbol
                    : typeof name === "string" && name.length > 0
                      ? name
                      : undefined;
              } catch {
                // Not every decoded target is an ERC-20.
              }
            }

            return {
              ok: true,
              to,
              data,
              decoded: {
                functionName: decodedFn.functionName,
                args: decodedFn.args as unknown,
                inputs,
              },
              resolvedAddress:
                typeof (r as unknown as { address?: unknown }).address === "string"
                  ? ((r as unknown as { address: string }).address as string)
                  : undefined,
              contractName:
                typeof r.contractResult?.name === "string" && r.contractResult.name.length > 0
                  ? r.contractResult.name
                  : typeof (r as unknown as { name?: unknown }).name === "string"
                    ? ((r as unknown as { name: string }).name as string)
                    : undefined,
              tokenLabel,
              clearSigning,
            };
          } catch (e) {
            if (clearSigning) {
              return {
                ok: true,
                to,
                data,
                decoded: { functionName: "", args: [], inputs: [] },
                contractName: clearSigning.metadata?.contractName,
                tokenLabel: clearSigningTokenLabel,
                clearSigning,
              };
            }

            const message = e instanceof Error ? e.message : String(e);
            let possibleSignatures: string[] | undefined;
            try {
              possibleSignatures = (await signatureLookup.loadFunctions(selector)).slice(0, 5);
            } catch {
              // ignore
            }
            return {
              ok: false,
              to,
              data,
              error: message,
              selector,
              possibleSignatures,
            };
          }
        }),
      );
    },
    enabled:
      chainIdSupported && builtOk && !!method && !!publicClient && calldataTargets.length > 0,
  });

  const executionMutation = useMutation({
    mutationFn: async () => {
      if (!walletClient || !method || !built.ok) {
        throw new Error("Missing wallet client or method");
      }

      try {
        return await walletClient.request({
          // wagmi/viem are typed for known methods; this app is intentionally generic.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          method: method as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          params: built.params as any,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        if (normalizedRedirectUrl) {
          try {
            const target = buildRedirectTarget(normalizedRedirectUrl, {
              error: message,
            });
            window.location.assign(target);
          } catch (redirectErr) {
            const redirectMessage =
              redirectErr instanceof Error ? redirectErr.message : String(redirectErr);
            throw new Error(`${message} (redirect failed: ${redirectMessage})`);
          }
        }

        throw new Error(message);
      }
    },
    onSuccess: (res) => {
      if (normalizedRedirectUrl) {
        const target = buildRedirectTarget(normalizedRedirectUrl, {
          result: res,
        });
        window.location.assign(target);
      }
    },
  });

  const result = executionMutation.data ?? null;
  const executionError = executionMutation.error?.message ?? null;
  const isExecuting = executionMutation.isPending;

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset state when inputs change
  React.useEffect(() => {
    executionMutation.reset();
    setCopyStatus(null);
  }, [method, rawParams, requestedChainId, redirectUrl]);

  const requestParamsPreview = React.useMemo(() => {
    if (requestError) return null;
    return safeJsonStringify(rpcParams, 2);
  }, [rpcParams, requestError]);

  const responseText = React.useMemo(() => {
    if (executionError) return executionError;
    if (result == null) return "";
    return typeof result === "string" ? result : safeJsonStringify(result, 2);
  }, [executionError, result]);

  const decodedOkCalls = React.useMemo(
    () => (decodedCalls?.filter((c) => c.ok) ?? []) as Array<Extract<DecodedCall, { ok: true }>>,
    [decodedCalls],
  );
  const decodedAddresses = React.useMemo(() => {
    const out = new Set<string>();
    for (const call of decodedOkCalls) {
      collectAddresses(call.to, out);
      collectAddresses(call.decoded.args, out);
    }
    return [...out];
  }, [decodedOkCalls]);
  const { data: ensLabels = {} } = useQuery({
    queryKey: ["ensLabels", decodedAddresses] as const,
    queryFn: async () => {
      const entries = await Promise.all(
        decodedAddresses.map(async (address) => {
          try {
            const name = await ensClient.getEnsName({ address: address as `0x${string}` });
            return name ? [address, name] : null;
          } catch {
            return null;
          }
        }),
      );

      return Object.fromEntries(entries.filter((entry) => entry != null)) as Record<string, string>;
    },
    enabled: decodedAddresses.length > 0,
  });
  const hasSuccessfulDecoding = decodedOkCalls.length > 0;
  const [requestPreviewMode, setRequestPreviewMode] = React.useState<"decoded" | "raw">("raw");
  const hadDecodedRef = React.useRef(false);

  // Default to Decoded when it becomes available for a request.
  React.useEffect(() => {
    const hasDecodedNow = decodedOkCalls.length > 0;
    if (!hadDecodedRef.current && hasDecodedNow) {
      setRequestPreviewMode("decoded");
    }
    hadDecodedRef.current = hasDecodedNow;
  }, [decodedOkCalls.length]);

  // If the decoded view disappears, fall back to Raw.
  React.useEffect(() => {
    if (requestPreviewMode === "decoded" && decodedOkCalls.length === 0) {
      setRequestPreviewMode("raw");
    }
  }, [decodedOkCalls.length, requestPreviewMode]);

  function renderPreviewModeControl() {
    if (hasSuccessfulDecoding) {
      return (
        <span className="inline-flex gap-3">
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              name="requestPreviewMode"
              value="raw"
              checked={requestPreviewMode === "raw"}
              onChange={() => setRequestPreviewMode("raw")}
            />
            Raw
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              name="requestPreviewMode"
              value="decoded"
              checked={requestPreviewMode === "decoded"}
              onChange={() => setRequestPreviewMode("decoded")}
            />
            Decoded
          </label>
        </span>
      );
    }

    if (calldataTargets.length > 0) {
      return <span className="text-gray-500">{isDecoding ? "Decoding" : "Raw"}</span>;
    }

    return null;
  }

  function getKnownAddressLabel(address: string) {
    const match = decodedOkCalls.find((call) => call.to.toLowerCase() === address.toLowerCase());
    return match?.tokenLabel || ensLabels[address.toLowerCase()] || match?.contractName;
  }

  function getAddressExplorerUrl(address: string) {
    const explorerUrl = requestedChain?.blockExplorers?.default.url;
    return explorerUrl ? `${explorerUrl.replace(/\/$/, "")}/address/${address}` : null;
  }

  function renderAddressValue(address: string, label?: string) {
    const explorerUrl = getAddressExplorerUrl(address);
    const addressKey = address.toLowerCase();
    const canToggleRawAddress = Boolean(label && label !== address);
    const showRawAddress = rawAddressDisplays.has(addressKey) || !canToggleRawAddress;

    return (
      <span className="inline-flex items-center gap-1">
        <img
          src={blo(address as `0x${string}`, 16)}
          alt=""
          width={16}
          height={16}
          style={{ display: "inline-block", marginRight: "0.25rem", verticalAlign: "-0.15em" }}
        />
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 underline decoration-dotted underline-offset-2"
          title={canToggleRawAddress ? `Show ${showRawAddress ? label : address}` : address}
          onClick={() => {
            if (!canToggleRawAddress) return;
            setRawAddressDisplays((current) => {
              const next = new Set(current);
              if (next.has(addressKey)) {
                next.delete(addressKey);
              } else {
                next.add(addressKey);
              }
              return next;
            });
          }}
        >
          {showRawAddress ? address : label}
        </button>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            title={`Open ${address} in block explorer`}
            className="no-underline"
            onClick={(event) => event.stopPropagation()}
          >
            ↗
          </a>
        )}
      </span>
    );
  }

  function renderInlineDecodedArg(value: unknown, input: AbiInput | undefined, depth = 0) {
    const type = formatAbiType(input);
    const rawType = input?.type;
    const indent = "  ".repeat(depth);
    const nextIndent = "  ".repeat(depth + 1);

    if (Array.isArray(value) && input?.components) {
      const isTupleArray =
        rawType === "tuple[]" || (typeof rawType === "string" && /^tuple\[\d+\]$/.test(rawType));

      if (isTupleArray) {
        return (
          <>
            {type} [
            {value.map((item, idx) => (
              <React.Fragment key={`${idx}:${safeJsonStringify(item)}`}>
                {`\n${nextIndent}`}
                {renderInlineDecodedArg(item, { ...input, type: "tuple" }, depth + 1)}
                {idx < value.length - 1 ? "," : ""}
              </React.Fragment>
            ))}
            {`\n${indent}`}]
          </>
        );
      }

      if (rawType === "tuple") {
        return (
          <>
            {type} {"{"}
            {input.components.map((component, idx) => (
              <React.Fragment key={`${idx}:${component.name ?? ""}:${component.type ?? ""}`}>
                {`\n${nextIndent}`}
                {component.name ? `${component.name}: ` : ""}
                {renderInlineDecodedArg(value[idx], component, depth + 1)}
                {idx < input.components!.length - 1 ? "," : ""}
              </React.Fragment>
            ))}
            {`\n${indent}`}
            {"}"}
          </>
        );
      }
    }

    if (Array.isArray(value)) {
      return (
        <>
          {type} [
          {value.map((item, idx) => (
            <React.Fragment key={`${idx}:${safeJsonStringify(item)}`}>
              {idx > 0 ? ", " : ""}
              {String(item)}
            </React.Fragment>
          ))}
          ]
        </>
      );
    }

    const maybeUint256 = input?.type === "uint256" ? parseOptionalBigInt(value) : undefined;
    const formatted =
      maybeUint256 != null
        ? formatBase18Significant(maybeUint256)
        : typeof value === "bigint"
          ? value.toString()
          : String(value);

    return (
      <>
        {type}{" "}
        {typeof value === "string" && isAddress(value)
          ? renderAddressValue(value, getKnownAddressLabel(value))
          : formatted}
      </>
    );
  }

  function renderClearSigningIntent(model: DisplayModel) {
    if (model.interpolatedIntent) return model.interpolatedIntent;
    if (typeof model.intent === "string") return model.intent;
    if (model.intent && typeof model.intent === "object") {
      return Object.entries(model.intent)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
    }
    return null;
  }

  function renderClearSigningFieldValue(field: DisplayField) {
    const rawAddress = field.rawAddress;
    const value = rawAddress && isAddress(rawAddress) ? rawAddress : field.value;

    return isAddress(value) ? renderAddressValue(value, field.value) : value;
  }

  function renderClearSigningField(field: DisplayField | DisplayFieldGroup, key: string) {
    if (isFieldGroup(field)) {
      return (
        <div key={key} className="space-y-2">
          {field.label && <div className="text-gray-500">{field.label}</div>}
          <div className="space-y-2 pl-4">
            {field.fields.map((item, idx) => renderClearSigningField(item, `${key}:${idx}`))}
          </div>
          {field.warning && <div className="text-gray-500">{field.warning.message}</div>}
        </div>
      );
    }

    return (
      <div key={key} className="space-y-1">
        <div className="text-gray-500">{field.label}</div>
        <div className="break-words">{renderClearSigningFieldValue(field)}</div>
        {field.embeddedCalldata && (
          <div className="pl-4">
            {renderClearSigningModel(
              field.embeddedCalldata.display,
              field.embeddedCalldata.callee,
              false,
              field.embeddedCalldata.callee,
            )}
          </div>
        )}
        {field.warning && <div className="text-gray-500">{field.warning.message}</div>}
      </div>
    );
  }

  function renderClearSigningModel(
    model: DisplayModel,
    fallbackContractName?: string,
    indented = false,
    contractAddress?: string,
    hideContract = false,
  ) {
    const contractName = model.metadata?.contractName || fallbackContractName || "Contract";
    const contractUrl = model.metadata?.info?.url;
    const intent = renderClearSigningIntent(model);

    return (
      <div className={`space-y-3${indented ? " pl-4" : ""}`}>
        {!hideContract && (
          <div className="space-y-1">
            <div className="text-gray-500">Contract</div>
            <div>
              {contractAddress && isAddress(contractAddress) ? (
                renderAddressValue(contractAddress, contractName)
              ) : contractUrl ? (
                <a href={contractUrl} target="_blank" rel="noreferrer">
                  {contractName}
                </a>
              ) : (
                <span>{contractName}</span>
              )}
            </div>
          </div>
        )}
        {intent && (
          <div className="space-y-1">
            <div className="text-gray-500">Intent</div>
            <div className="whitespace-pre-wrap break-words">{intent}</div>
          </div>
        )}
        {model.fields && model.fields.length > 0 && (
          <div className="space-y-2">
            {model.fields.map((field, idx) => renderClearSigningField(field, String(idx)))}
          </div>
        )}
        {model.warnings?.map((warning, idx) => (
          <div key={`${warning.code}:${idx}`} className="text-gray-500">
            {warning.message}
          </div>
        ))}
      </div>
    );
  }

  function renderManualDecodedCall(
    call: Extract<DecodedCall, { ok: true }>,
    argIndentDepth: number,
  ) {
    const args = Array.isArray(call.decoded.args) ? (call.decoded.args as unknown[]) : [];
    const inputs = call.decoded.inputs ?? [];

    return (
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="text-gray-500">Function</div>
          <div>{call.decoded.functionName}</div>
        </div>
        {args.map((arg, idx) => (
          <div key={`${idx}:${safeJsonStringify(arg)}`} className="space-y-1">
            <div className="text-gray-500">{inputs[idx]?.name || `Arg ${idx + 1}`}</div>
            <div className="break-words">
              {renderInlineDecodedArg(arg, inputs[idx], argIndentDepth)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderDecodedCallListItem(call: DecodedCall, i: number) {
    const to = call.to;
    const contractLabel =
      call.ok && call.clearSigning?.metadata?.contractName
        ? call.clearSigning.metadata.contractName
        : call.ok
          ? call.contractName || call.tokenLabel || call.to
          : to;

    return (
      <li key={`${to ?? "unknown"}:${call.data ?? ""}:${i}`} className="space-y-2">
        <div>
          {`Call ${i + 1}`}
          {to && isAddress(to) && (
            <>
              {" to "}
              {renderAddressValue(to, contractLabel)}
            </>
          )}
        </div>
        <div className="pl-4">
          {call.ok && call.clearSigning ? (
            renderClearSigningModel(
              call.clearSigning,
              call.contractName || call.tokenLabel || call.to,
              false,
              call.to,
              true,
            )
          ) : call.ok ? (
            renderManualDecodedCall(call, 1)
          ) : (
            <div className="space-y-1">
              <div className="text-gray-500">Decoding</div>
              <div>{call.error}</div>
              {call.possibleSignatures && call.possibleSignatures.length > 0 && (
                <div className="text-gray-500">
                  Possible signatures: {call.possibleSignatures.join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      </li>
    );
  }

  function renderDecodedParameters() {
    const clearSigningCalls = decodedOkCalls.filter((call) => call.clearSigning);

    if (method === "wallet_sendCalls" && decodedCalls && clearSigningCalls.length > 0) {
      if (decodedCalls.length > 1) {
        return (
          <ul className="list-disc space-y-5 pl-5">
            {decodedCalls.map((call, i) => renderDecodedCallListItem(call, i))}
          </ul>
        );
      }
    }

    if (clearSigningCalls.length > 0 && clearSigningCalls.length === decodedOkCalls.length) {
      if (clearSigningCalls.length > 1) {
        return (
          <ul className="list-disc space-y-5 pl-5">
            {clearSigningCalls.map((call, i) => renderDecodedCallListItem(call, i))}
          </ul>
        );
      }

      return (
        <div className="space-y-5">
          {clearSigningCalls.map((call, i) => (
            <div key={`${call.to}:${call.data}:${i}`} className="space-y-2">
              {renderClearSigningModel(
                call.clearSigning!,
                call.contractName || call.tokenLabel || call.to,
                false,
                call.to,
              )}
            </div>
          ))}
        </div>
      );
    }

    if (method === "wallet_sendCalls") {
      return (
        <pre className="whitespace-pre-wrap break-words">
          <div>{"["}</div>
          <div>{"  {"}</div>
          <div>{`    "calls": [`}</div>
          {decodedOkCalls.map((call, i) => {
            const args = Array.isArray(call.decoded.args) ? (call.decoded.args as unknown[]) : [];
            const inputs = call.decoded.inputs ?? [];

            return (
              <React.Fragment key={`${call.to}:${call.data}:${i}`}>
                <div>{"      {"}</div>
                <div>
                  {`        "to": "`}
                  {renderAddressValue(call.to, call.tokenLabel || call.contractName)}
                  {`",`}
                </div>
                <div>{`        "data": "${call.decoded.functionName}(`}</div>
                {args.map((arg, idx) => (
                  <div key={`${idx}:${safeJsonStringify(arg)}`}>
                    {"          "}
                    {renderInlineDecodedArg(arg, inputs[idx], 5)}
                    {idx < args.length - 1 ? "," : ""}
                  </div>
                ))}
                <div>{`        )"`}</div>
                <div>{`      }${i < decodedOkCalls.length - 1 ? "," : ""}`}</div>
              </React.Fragment>
            );
          })}
          <div>{"    ]"}</div>
          <div>{"  }"}</div>
          <div>{"]"}</div>
        </pre>
      );
    }

    return (
      <pre className="whitespace-pre-wrap break-words">
        <div>[</div>
        {decodedOkCalls.map((call, i) => {
          const args = Array.isArray(call.decoded.args) ? (call.decoded.args as unknown[]) : [];
          const inputs = call.decoded.inputs ?? [];

          return (
            <React.Fragment key={`${call.to}:${call.data}:${i}`}>
              <div>{"  {"}</div>
              <div>
                {`    "to": "`}
                {renderAddressValue(call.to, call.tokenLabel || call.contractName)}
                {`",`}
              </div>
              <div>{`    "data": "${call.decoded.functionName}(`}</div>
              {args.map((arg, idx) => (
                <div key={`${idx}:${safeJsonStringify(arg)}`}>
                  {"      "}
                  {renderInlineDecodedArg(arg, inputs[idx], 3)}
                  {idx < args.length - 1 ? "," : ""}
                </div>
              ))}
              <div>{`    )"`}</div>
              <div>{`  }${i < decodedOkCalls.length - 1 ? "," : ""}`}</div>
            </React.Fragment>
          );
        })}
        <div>]</div>
      </pre>
    );
  }

  function renderRequestJson() {
    if (personalSignPreview) {
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <h3>Method</h3>
            <pre className="whitespace-pre-wrap break-words">personal_sign</pre>
          </div>
          <div className="space-y-1">
            <h3>Message</h3>
            <pre className="whitespace-pre-wrap break-words">
              {personalSignPreview.message ?? "(missing)"}
            </pre>
          </div>
          {personalSignPreview.address && (
            <div className="space-y-1">
              <h3>Address</h3>
              <pre className="whitespace-pre-wrap break-words">{personalSignPreview.address}</pre>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <h3>Method</h3>
          <pre className="whitespace-pre-wrap break-words">{method ?? "(missing)"}</pre>
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3>Parameters</h3>
            {renderPreviewModeControl()}
          </div>
          {requestPreviewMode === "decoded" && hasSuccessfulDecoding ? (
            renderDecodedParameters()
          ) : (
            <>
              <pre className="whitespace-pre-wrap break-words">{requestParamsPreview}</pre>
              {calldataTargets.length > 0 &&
                decodedCalls &&
                !isDecoding &&
                !hasSuccessfulDecoding && (
                  <p className="text-gray-500">
                    Decoding did not resolve a function for this calldata.
                  </p>
                )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-950">
      <main className="box-border flex min-h-screen max-w-2xl flex-col gap-5 p-4">
        <header>
          <h1>
            <a href="/">txlink</a>
          </h1>
        </header>

        {!hasRequestQuery && (
          <section className="space-y-3">
            <div>
              Build links with <code>method</code>, <code>chainId</code>, and URL-encoded JSON in{" "}
              <code>params</code>. See the <a href="/SKILL.md">txlink skill</a> for formats and
              examples.
            </div>
            <div className="space-y-1">
              <h2>Examples</h2>
            </div>
            <div className="flex max-w-xl flex-wrap gap-2">
              <button type="button" onClick={() => window.location.assign(sampleSignPath)}>
                Sign Hello world
              </button>
              {clearSigningSamplePaths.map((sample) => (
                <button
                  type="button"
                  key={sample.name}
                  title={sample.description}
                  onClick={() => window.location.assign(sample.path)}
                >
                  {sample.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {hasRequestQuery && !isConnected && (
          <section className="space-y-3">
            <div className="space-y-1">
              <h2>Wallet</h2>
              <div className="text-gray-500">Connect to continue</div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                {connectors.map((connector) => (
                  <button type="button" key={connector.uid} onClick={() => connect({ connector })}>
                    {connector.name}
                  </button>
                ))}
              </div>
              {error?.message && (
                <div className={alertClass(true)}>
                  <div>Connection error</div>
                  <div className="mt-1">{error.message}</div>
                </div>
              )}
            </div>
          </section>
        )}

        {!normalizedRedirectUrl && (result != null || executionError != null) && (
          <section className="space-y-3">
            <div className="space-y-1">
              <h2>Response</h2>
              <div className="text-gray-500">Copy the value and send it back</div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await copyToClipboard(responseText);
                    setCopyStatus("Copied");
                  }}
                  disabled={!responseText}
                >
                  Copy
                </button>
                {copyStatus && <span className="text-gray-500">{copyStatus}</span>}
              </div>

              <textarea
                readOnly
                rows={10}
                value={responseText}
                className="min-h-24 w-full outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </section>
        )}

        {hasRequestQuery && (
          <section className="space-y-3">
            <div className="space-y-1">
              <h2>Request</h2>
              <div className="text-gray-500">Review the method and parameters before opening.</div>
            </div>
            <div className="space-y-3">
              {requestError ? (
                <>
                  <div className={alertClass(true)}>
                    <div>Invalid request</div>
                    <div className="mt-1">{requestError}</div>
                  </div>
                  {personalSignPreview && renderRequestJson()}
                </>
              ) : (
                <>
                  {needsChainSwitch && (
                    <div className={alertClass(Boolean(chainSwitchError))}>
                      <div>
                        {chainSwitchError
                          ? "Chain switch failed"
                          : isSwitchingChain
                            ? "Switching chain"
                            : "Chain switch required"}
                      </div>
                      <div className="mt-1">
                        {chainSwitchError
                          ? chainSwitchError
                          : isSwitchingChain
                            ? `Approve switching to chainId ${requestedChainId} in your wallet.`
                            : `Please switch to chainId ${requestedChainId} in your wallet.`}
                      </div>
                    </div>
                  )}

                  {renderRequestJson()}
                </>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => executionMutation.mutate()}
                  disabled={!canOpenRequest || isExecuting}
                >
                  {isExecuting ? <>Opening</> : <>Open Request</>}
                </button>
                {normalizedRedirectUrl && (
                  <span className="text-gray-500">Redirect after approval</span>
                )}
              </div>
              {!canOpenRequest && !isExecuting && (
                <p className="text-gray-500">
                  {!isConnected
                    ? "Connect your wallet above to open this request."
                    : needsChainSwitch
                      ? `Switch to chainId ${requestedChainId} to continue.`
                      : requestError
                        ? `Fix request: ${requestError}`
                        : "Waiting for wallet client…"}
                </p>
              )}
            </div>
          </section>
        )}

        {isConnected && (
          <footer className="text-gray-500">
            Connected as {connectedAddress ?? "(unknown)"}{" "}
            <a
              href="#disconnect"
              onClick={(event) => {
                event.preventDefault();
                disconnect();
              }}
            >
              Disconnect
            </a>
          </footer>
        )}

        <p style={{ marginTop: "auto" }}>
          <a href="https://github.com/stephancill/open-wallet">github</a>
          {" - "}
          <a href="https://x.com/stephancill">twitter</a>
          {" - "}
          <a href="https://stupidtech.net">stupidtech.net</a>
          {" - "}
          <a href="https://txlink.stupidtech.net/SKILL.md">skill</a>
        </p>
      </main>
    </div>
  );
}

export default App;
