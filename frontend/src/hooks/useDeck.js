import { useAccount, useReadContract, useWriteContract } from "wagmi";
import toast from "react-hot-toast";
import { CONTRACT_ADDRESSES, ABIS } from "../contracts";

export function useDeck() {
  const { address } = useAccount();

  const {
    data: deckData,
    isLoading: deckLoading,
    refetch,
  } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsDeck,
    abi: ABIS.DeckWarsDeck,
    functionName: "getDeck",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const { data: hasDeck } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsDeck,
    abi: ABIS.DeckWarsDeck,
    functionName: "hasDeck",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: deckLocked } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsDeck,
    abi: ABIS.DeckWarsDeck,
    functionName: "deckLocked",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract, isPending } = useWriteContract();

  const registerDeck = async (cards) => {
    if (!address) {
      toast.error("Connect your wallet first.");
      return;
    }
    if (!Array.isArray(cards) || cards.length !== 20) {
      toast.error("Deck must have exactly 20 cards.");
      return;
    }
    const arr = cards.map((c) => BigInt(c));
    let toastId;
    try {
      toastId = toast.loading("Saving deck onchain...");
      await writeContract({
        address: CONTRACT_ADDRESSES.DeckWarsDeck,
        abi: ABIS.DeckWarsDeck,
        functionName: "registerDeck",
        args: [arr],
      });
      toast.dismiss(toastId);
      toast.success("Deck saved onchain!");
      await refetch();
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      if (err?.message?.includes("user rejected")) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(err?.shortMessage || err.message || "Failed to save deck.");
      }
    }
  };

  const deck = deckData ? deckData.map((n) => Number(n)) : [];

  return {
    deck,
    hasDeck: Boolean(hasDeck),
    isLocked: Boolean(deckLocked),
    isLoading: deckLoading || isPending,
    registerDeck,
    refetch,
  };
}

