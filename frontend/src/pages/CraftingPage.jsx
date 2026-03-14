import React, { useState } from "react";
import { useCards } from "../hooks/useCards";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import toast from "react-hot-toast";
import { CONTRACT_ADDRESSES, ABIS } from "../contracts";
import CardDisplay from "../components/CardDisplay";
import LoadingSpinner from "../components/LoadingSpinner";

const RECIPES = [
  { inputRarity: 0, label: "3× Common → 1× Uncommon" },
  { inputRarity: 1, label: "3× Uncommon → 1× Rare" },
  { inputRarity: 2, label: "3× Rare → 1× Epic" },
  { inputRarity: 3, label: "3× Epic → 1× Legendary" },
];

export default function CraftingPage() {
  const { cards, isLoading: cardsLoading } = useCards();
  const [selectedCardId, setSelectedCardId] = useState(null);
  const { address } = useAccount();
  const { data: craftCountForUser } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsCraft,
    abi: ABIS.DeckWarsCraft,
    functionName: "getCraftCount",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { writeContract, isPending } = useWriteContract();

  const craftsDone = craftCountForUser != null ? Number(craftCountForUser) : 0;

  const cardsByRarity = (rarity) =>
    cards.filter((c) => c.data?.rarity === rarity && c.balance >= 3);

  const canCraft = selectedCardId && cards.find((c) => c.id === selectedCardId)?.balance >= 3;

  const handleCraft = async () => {
    if (!selectedCardId || !canCraft) return;
    let toastId;
    try {
      toastId = toast.loading("Forging card...");
      await writeContract({
        address: CONTRACT_ADDRESSES.DeckWarsCraft,
        abi: ABIS.DeckWarsCraft,
        functionName: "craftCard",
        args: [BigInt(selectedCardId)],
      });
      toast.dismiss(toastId);
      toast.success("Forged! Check your collection for the new card.");
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      toast.error(err?.shortMessage || err.message || "Craft failed.");
    }
  };

  if (cardsLoading) {
    return (
      <div className="py-8">
        <LoadingSpinner label="Loading cards..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Crafting</h1>
      <p className="text-[var(--text-secondary)]">
        Burn 3 of the same card to receive 1 random card of the next rarity.
      </p>

      <div className="rounded-lg bg-amber-900/20 border border-amber-700/50 px-4 py-2 text-sm">
        Crafter Quest: {craftsDone} / 3 crafts
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {RECIPES.map(({ inputRarity, label }) => (
          <div
            key={inputRarity}
            className="rounded-lg bg-[#12121a] p-4 border border-[#2a2a3a]"
          >
            <h3 className="font-semibold mb-3">{label}</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {cardsByRarity(inputRarity).map((card) => (
                <div
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  className={selectedCardId === card.id ? "ring-2 ring-[var(--accent-purple)] rounded-xl" : ""}
                >
                  <CardDisplay
                    cardId={card.id}
                    cardData={card.data}
                    ownedCount={card.balance}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={handleCraft}
              disabled={!canCraft || selectedCardId === null || isPending}
              className="rounded-lg bg-[var(--accent-purple)] px-4 py-2 font-semibold disabled:opacity-50 w-full"
            >
              Forge
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
