import React from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import toast from "react-hot-toast";
import { CONTRACT_ADDRESSES, ABIS } from "../contracts";
import { usePacks } from "../hooks/usePacks";
import LoadingSpinner from "../components/LoadingSpinner";

const PACKS = [
  {
    type: 0,
    name: "Silver",
    price: "5",
    cards: 3,
    rates: "Common 60%, Uncommon 25%, Rare 13%, Epic 1.5%, Legendary 0.5%",
    pity: 50,
  },
  {
    type: 1,
    name: "Gold",
    price: "15",
    cards: 5,
    rates: "Common 40%, Uncommon 30%, Rare 20%, Epic 7%, Legendary 3%",
    pity: 20,
    badge: "MOST POPULAR",
  },
  {
    type: 2,
    name: "Diamond",
    price: "50",
    cards: 5,
    rates: "Common 20%, Uncommon 25%, Rare 30%, Epic 10%, Legendary 15%",
    pity: 10,
  },
];

export default function PackShop() {
  const { address } = useAccount();
  const { openPack, pityProgress, isLoading } = usePacks();
  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESSES.HLUSD,
    abi: ABIS.HLUSD,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { writeContract: faucetWrite, isPending: faucetPending } = useWriteContract();

  const hlusdBalance = balance != null ? Number(balance) / 1e18 : 0;

  const handleFaucet = async () => {
    let toastId;
    try {
      toastId = toast.loading("Getting HLUSD...");
      await faucetWrite({
        address: CONTRACT_ADDRESSES.HLUSD,
        abi: ABIS.HLUSD,
        functionName: "faucet",
      });
      toast.dismiss(toastId);
      toast.success("Received 100 HLUSD!");
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      toast.error(err?.shortMessage || "Faucet failed.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Pack Shop</h1>
        <div className="flex items-center gap-3">
          <span className="text-[var(--text-secondary)]">
            Balance: <strong className="text-white">{hlusdBalance.toFixed(2)} HLUSD</strong>
          </span>
          <button
            onClick={handleFaucet}
            disabled={faucetPending}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            Get Free HLUSD (Faucet)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PACKS.map((pack) => {
          const pity = pityProgress[pack.type] ?? { current: 0, threshold: pack.pity };
          return (
            <div
              key={pack.type}
              className="rounded-lg bg-[#12121a] border border-[#2a2a3a] p-6 relative"
            >
              {pack.badge && (
                <span className="absolute -top-2 right-4 rounded bg-[var(--accent-gold)] text-[#0a0a0f] text-xs font-bold px-2 py-0.5">
                  {pack.badge}
                </span>
              )}
              <h2 className="text-xl font-semibold">{pack.name} Pack</h2>
              <p className="text-2xl font-bold text-[var(--accent-gold)] mt-1">
                {pack.price} HLUSD
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                {pack.cards} cards per pack
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {pack.rates}
              </p>
              <p className="text-xs mt-2">
                Pity: every {pack.pity} packs = guaranteed minimum. Progress:{" "}
                {pity.current} / {pity.threshold}
              </p>
              <div className="mt-2 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-purple)] rounded-full"
                  style={{
                    width: `${Math.min(100, (pity.current / pity.threshold) * 100)}%`,
                  }}
                />
              </div>
              <button
                onClick={() => openPack(pack.type)}
                disabled={isLoading || hlusdBalance < parseFloat(pack.price)}
                className="mt-4 w-full rounded-lg bg-[var(--accent-purple)] py-2 font-semibold disabled:opacity-50"
              >
                Open {pack.name} Pack
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
