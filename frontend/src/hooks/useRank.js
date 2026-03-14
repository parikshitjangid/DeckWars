import { useAccount, useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, ABIS } from "../contracts";

export function useRank() {
  const { address } = useAccount();

  const {
    data: stats,
    isLoading,
  } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsRank,
    abi: ABIS.DeckWarsRank,
    functionName: "getStats",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: leaderboard } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsRank,
    abi: ABIS.DeckWarsRank,
    functionName: "getLeaderboardWithRP",
  });

  const tierNames = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Legendary"];

  const parsedStats = stats
    ? {
        rankPoints: Number(stats.rankPoints ?? stats[0] ?? 0n),
        wins: Number(stats.wins ?? stats[1] ?? 0n),
        losses: Number(stats.losses ?? stats[2] ?? 0n),
        currentRank: Number(stats.currentRank ?? stats[3] ?? 0),
        totalDamageDealt: Number(stats.totalDamageDealt ?? stats[4] ?? 0n),
      }
    : null;

  const players = leaderboard?.[0] || leaderboard?.players || [];
  const rps = leaderboard?.[1] || leaderboard?.rps || [];

  const board = players.map((p, i) => ({
    address: p,
    rp: Number(rps[i] ?? 0n),
  }));

  return {
    stats: parsedStats,
    rankName: parsedStats ? tierNames[parsedStats.currentRank] || "Bronze" : "Bronze",
    leaderboard: board,
    isLoading,
  };
}

