import React from "react";
import { useSeason } from "../hooks/useSeason";
import { useRank } from "../hooks/useRank";
import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, ABIS } from "../contracts";
import SeasonCountdown from "../components/SeasonCountdown";
import LeaderboardTable from "../components/LeaderboardTable";
import LoadingSpinner from "../components/LoadingSpinner";

const RANK_REWARDS = [
  { tier: "Silver", amount: "5 HLUSD" },
  { tier: "Gold", amount: "15 HLUSD" },
  { tier: "Platinum", amount: "30 HLUSD" },
  { tier: "Diamond", amount: "60 HLUSD" },
  { tier: "Legendary", amount: "150 HLUSD" },
];

export default function SeasonPage() {
  const { season, name, timeLeft, isActive } = useSeason();
  const { stats, rankName, leaderboard, isLoading } = useRank();
  const { data: claimsOpen } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsRewards,
    abi: ABIS.DeckWarsRewards,
    functionName: "claimsOpen",
  });

  const leaderboardWithRank = (leaderboard || []).map((row) => ({
    ...row,
    rank: row.rp >= 5000 ? 4 : row.rp >= 3000 ? 3 : row.rp >= 1500 ? 2 : row.rp >= 500 ? 1 : 0,
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Season</h1>

      <section className="rounded-lg bg-[#12121a] p-6 border border-[#2a2a3a]">
        <h2 className="text-lg font-semibold mb-2">{name || `Season ${season}`}</h2>
        <p className="text-[var(--text-secondary)] text-sm mb-2">
          Time remaining: <SeasonCountdown timeRemainingSeconds={timeLeft} />
        </p>
        {!isActive && (
          <p className="text-amber-400 text-sm">Season has ended.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Your Rank</h2>
        {isLoading ? (
          <LoadingSpinner label="Loading rank..." />
        ) : stats ? (
          <div className="rounded-lg bg-[#12121a] p-4 border border-[#2a2a3a] grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Tier</p>
              <p className="font-semibold">{rankName}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">RP</p>
              <p className="font-semibold">{stats.rankPoints}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Wins / Losses</p>
              <p className="font-semibold">{stats.wins} / {stats.losses}</p>
            </div>
          </div>
        ) : (
          <p className="text-[var(--text-secondary)]">Play battles to earn rank.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Rank Rewards (HLUSD)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--text-secondary)]">
                <th className="py-2">Tier</th>
                <th className="py-2">Reward</th>
              </tr>
            </thead>
            <tbody>
              {RANK_REWARDS.map((r) => (
                <tr key={r.tier} className="border-t border-[#2a2a3a]">
                  <td className="py-2">{r.tier}</td>
                  <td className="py-2">{r.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Leaderboard (Top 10)</h2>
        <LeaderboardTable leaderboard={leaderboardWithRank} />
      </section>

      {claimsOpen && (
        <section>
          <a
            href="#claim"
            className="inline-block rounded-lg bg-[var(--accent-gold)] text-[#0a0a0f] px-4 py-2 font-semibold"
          >
            Claim Season Rewards
          </a>
        </section>
      )}
    </div>
  );
}
