import type { Chain, PublicClient } from "viem";
import { createPublicClient, http, numberToHex } from "viem";

// Minimal JSON-RPC provider surface (matches the EIP-1193 provider returned by
// a connector); enough for chain switching and executing wallet methods without
// depending on wagmi's chain registry.
export type JsonRpcProvider = {
  request(args: { method: string; params?: readonly unknown[] }): Promise<unknown>;
};

export type ChainNativeCurrency = {
  name: string;
  symbol: string;
  decimals: number;
};

// Shape returned by https://evm.stupidtech.net/v1/chains/<chainId>
export type ChainInfo = {
  chainId: number;
  name: string;
  chainSlug: string;
  shortName: string;
  isTestnet: boolean;
  nativeCurrency?: ChainNativeCurrency;
  aliases?: string[];
  rpcUrls?: string[];
  blockSpeedMs?: number;
};

export const CHAIN_API_BASE = "https://evm.stupidtech.net/v1";

export function chainTransport(chainId: number) {
  return http(`${CHAIN_API_BASE}/${chainId}`);
}

function isChainInfo(value: unknown): value is ChainInfo {
  const obj = value as ChainInfo;
  return obj != null && typeof obj.chainId === "number" && typeof obj.name === "string";
}

export async function fetchChainInfo(chainId: number): Promise<ChainInfo | null> {
  try {
    const response = await fetch(`${CHAIN_API_BASE}/chains/${chainId}`);
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    return isChainInfo(data) ? data : null;
  } catch {
    return null;
  }
}

// Build a viem `Chain` from the API chain info so decoding/reads work for chains
// that are not statically registered with wagmi.
export function toViemChain(info: ChainInfo): Chain {
  const nativeCurrency = info.nativeCurrency ?? {
    name: info.name,
    symbol: info.shortName.toUpperCase(),
    decimals: 18,
  };
  return {
    id: info.chainId,
    name: info.name,
    nativeCurrency,
    rpcUrls: {
      default: {
        http:
          info.rpcUrls && info.rpcUrls.length > 0
            ? info.rpcUrls
            : [`${CHAIN_API_BASE}/${info.chainId}`],
      },
    },
    testnet: info.isTestnet,
  } as Chain;
}

const publicClientCache = new Map<number, PublicClient>();

// Return a cached public client for the chain; used for on-chain decoding reads.
export function getPublicClient(info: ChainInfo): PublicClient {
  const cached = publicClientCache.get(info.chainId);
  if (cached) return cached;

  const client = createPublicClient({
    chain: toViemChain(info),
    transport: chainTransport(info.chainId),
  });
  publicClientCache.set(info.chainId, client);
  return client;
}

// Detect the wallet error (EIP-1193 code 4902 / "unrecognized chain") that means
// the chain must be added to the wallet before it can be switched to.
export function isChainNotAddedError(error: unknown): boolean {
  const err = (error ?? {}) as { code?: unknown; message?: unknown };
  if (err.code === 4902) return true;
  const text = typeof err.message === "string" ? err.message.toLowerCase() : "";
  return /unrecognized chain|new chain|add chain|chain.*not.*add|4902|not added to wallet|does not support.*chain/.test(
    text,
  );
}

// Switch the connected wallet to the chain, auto-adding it (wallet_addEthereumChain)
// when the wallet reports the chain is unknown. The chain name passed to addEthereumChain
// is the API-provided `name` (e.g. "Base", "Step Network").
export async function switchToChain(provider: JsonRpcProvider, info: ChainInfo): Promise<void> {
  const chainIdHex = numberToHex(info.chainId);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (error) {
    if (!isChainNotAddedError(error)) throw error;

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: info.name,
          nativeCurrency: info.nativeCurrency ?? {
            name: info.name,
            symbol: info.shortName.toUpperCase(),
            decimals: 18,
          },
          rpcUrls:
            info.rpcUrls && info.rpcUrls.length > 0
              ? info.rpcUrls
              : [`${CHAIN_API_BASE}/${info.chainId}`],
        },
      ],
    });
  }
}
