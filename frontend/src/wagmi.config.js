import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";

// HeLa blockchain — https://helalabs.com
export const helaTestnet = defineChain({
  id: 666888,
  name: "HeLa Testnet",
  nativeCurrency: { name: "HLUSD", symbol: "HLUSD", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.helachain.com"] },
  },
  blockExplorers: {
    default: {
      name: "HeLa Testnet Explorer",
      url: "https://testnet-blockexplorer.helachain.com",
    },
  },
});

export const helaMainnet = defineChain({
  id: 8668,
  name: "HeLa Official Runtime",
  nativeCurrency: { name: "HLUSD", symbol: "HLUSD", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet-rpc.helachain.com"] },
  },
  blockExplorers: {
    default: {
      name: "HeLaScan",
      url: "https://helascan.io",
    },
  },
});

export const defaultChain =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_HELA_MAINNET === "true"
    ? helaMainnet
    : helaTestnet;

export const config = createConfig({
  chains: [helaTestnet, helaMainnet],
  connectors: [injected()],
  transports: {
    [helaTestnet.id]: http("https://testnet-rpc.helachain.com"),
    [helaMainnet.id]: http("https://mainnet-rpc.helachain.com"),
  },
});
