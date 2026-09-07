import type { Chain } from "viem";
import { createConfig, http, type Transport } from "wagmi";
import { baseAccount } from "wagmi/connectors";
import { mainnet } from "wagmi/chains";

const chainList = [mainnet] as unknown as readonly [Chain, ...Chain[]];

const transports: Record<number, Transport> = chainList.reduce(
  (acc, chain) => {
    acc[chain.id] = http(`https://evm.stupidtech.net/v1/${chain.id}`);
    return acc;
  },
  {} as Record<number, Transport>,
);

export const config = createConfig({
  connectors: [
    baseAccount({
      appName: "txlink",
      preference: {
        telemetry: false,
      },
    }),
  ],
  chains: chainList,
  transports,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
