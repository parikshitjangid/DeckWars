import React from "react";
import { useAccount, useConnect, useDisconnect, useEnsName, useChainId } from "wagmi";
import { injected } from "wagmi/connectors";
import toast from "react-hot-toast";
import { helaTestnet, helaMainnet } from "../wagmi.config";

const HELA_CHAIN_IDS = [helaTestnet.id, helaMainnet.id];
const chainName = (id) => (id === 8668 ? "HeLa Mainnet" : id === 666888 ? "HeLa Testnet" : "HeLa");

function shorten(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function WalletButton() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: ensName } = useEnsName({ chainId: 1, address, query: { enabled: !!address } });
  const { connect, connectors, isPending: isConnecting } = useConnect({
    connector: injected(),
    onError(error) {
      if (error?.message?.includes("User rejected")) {
        toast.error("Wallet connection rejected.");
      } else {
        toast.error(error.message || "Failed to connect wallet.");
      }
    },
  });
  const { disconnect } = useDisconnect();

  const wrongNetwork = isConnected && !HELA_CHAIN_IDS.includes(chainId);

  const handleConnect = () => {
    const connector = connectors.find((c) => c.id === "injected") || connectors[0];
    if (!connector) {
      toast.error("No injected wallet found.");
      return;
    }
    connect({ connector });
  };

  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        className="rounded-md bg-[var(--accent-purple)] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
        disabled={isConnecting}
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex flex-col text-right text-xs">
        <span className="font-mono">{ensName || shorten(address)}</span>
        <span className="text-[var(--text-secondary)]">
          {wrongNetwork ? "Switch to HeLa" : chainName(chainId)}
        </span>
      </div>
      <button
        onClick={() => disconnect()}
        className="rounded-md border border-purple-500 px-3 py-1.5 text-xs sm:text-sm font-medium hover:bg-purple-500/10"
      >
        Disconnect
      </button>
    </div>
  );
}

