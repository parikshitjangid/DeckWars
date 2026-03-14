import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, ABIS } from "../contracts";

export function useSeason() {
  const { data: currentSeason } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsSeason,
    abi: ABIS.DeckWarsSeason,
    functionName: "getCurrentSeason",
  });

  const { data: name } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsSeason,
    abi: ABIS.DeckWarsSeason,
    functionName: "getSeasonName",
    args: currentSeason ? [currentSeason] : undefined,
    query: { enabled: !!currentSeason },
  });

  const { data: timeLeft } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsSeason,
    abi: ABIS.DeckWarsSeason,
    functionName: "timeRemaining",
  });

  const { data: isActive } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsSeason,
    abi: ABIS.DeckWarsSeason,
    functionName: "isSeasonActive",
  });

  return {
    season: currentSeason ? Number(currentSeason) : 0,
    name: name || "",
    timeLeft: timeLeft ? Number(timeLeft) : 0,
    isActive: Boolean(isActive),
  };
}

