import { useMemo } from "react";
import { useAccount, useReadContracts, useWriteContract } from "wagmi";
import toast from "react-hot-toast";
import { CONTRACT_ADDRESSES, ABIS } from "../contracts";

const CARD_IDS = Array.from({ length: 20 }, (_, i) => i + 1);

function parseCardData(raw) {
  if (!raw || !Array.isArray(raw)) return null;
  return {
    name: String(raw[0] ?? ""),
    attack: Number(raw[1] ?? 0),
    defense: Number(raw[2] ?? 0),
    element: Number(raw[3] ?? 0),
    rarity: Number(raw[4] ?? 0),
    maxSupply: BigInt(raw[5] ?? 0),
    seasonMinted: BigInt(raw[6] ?? 0),
  };
}

export function useCards() {
  const { address } = useAccount();

  const balanceContracts = CARD_IDS.map((id) => ({
    address: CONTRACT_ADDRESSES.DeckWarsCard,
    abi: ABIS.DeckWarsCard,
    functionName: "balanceOf",
    args: [address, BigInt(id)],
  }));
  const catalogContracts = CARD_IDS.map((id) => ({
    address: CONTRACT_ADDRESSES.DeckWarsCard,
    abi: ABIS.DeckWarsCard,
    functionName: "getCard",
    args: [BigInt(id)],
  }));

  const {
    data,
    isLoading: balancesLoading,
    error: balancesError,
    refetch,
  } = useReadContracts({
    query: { enabled: !!address },
    contracts: [...balanceContracts, ...catalogContracts],
  });

  const {
    writeContract,
    isPending: writePending,
  } = useWriteContract();

  const mintStarterPack = async () => {
    if (!address) {
      toast.error("Connect your wallet first.");
      return;
    }
    let toastId;
    try {
      toastId = toast.loading("Minting starter pack...");
      await writeContract({
        address: CONTRACT_ADDRESSES.DeckWarsCard,
        abi: ABIS.DeckWarsCard,
        functionName: "mintStarterPack",
        args: [address],
      });
      toast.dismiss(toastId);
      toast.success("Starter pack minted!");
      await refetch();
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      if (err?.message?.includes("user rejected")) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(err?.shortMessage || err.message || "Failed to mint pack.");
      }
    }
  };

  const cards = useMemo(() => {
    if (!data) return [];
    return CARD_IDS.map((id, idx) => {
      const balance = data[idx]?.result != null ? Number(data[idx].result) : 0;
      const rawCard = data[CARD_IDS.length + idx]?.result;
      const data_ = parseCardData(Array.isArray(rawCard) ? rawCard : rawCard);
      return {
        id,
        balance,
        data: data_,
      };
    });
  }, [data]);

  const hasMintedStarter = useMemo(
    () => cards.some((c) => c.balance > 0),
    [cards]
  );

  return {
    cards,
    isLoading: balancesLoading || writePending,
    error: balancesError,
    mintStarterPack,
    hasMintedStarter,
    refetch,
  };
}

