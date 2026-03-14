import React from "react";
import { useAccount } from "wagmi";

const RANK_NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Legendary"];

function rpToRank(rp) {
  if (rp >= 5000) return 4;
  if (rp >= 3000) return 3;
  if (rp >= 1500) return 2;
  if (rp >= 500) return 1;
  return 0;
}

function shorten(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function LeaderboardTable({ leaderboard }) {
  const { address } = useAccount();
  const list = Array.isArray(leaderboard) ? leaderboard : [];

  return (
    <div className="overflow-x-auto rounded-lg border border-[#2a2a3a]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#12121a] text-left">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Address</th>
            <th className="px-4 py-3">RP</th>
            <th className="px-4 py-3">Rank</th>
          </tr>
        </thead>
        <tbody>
          {list.map((row, i) => {
            const isYou =
              address && row.address?.toLowerCase() === address.toLowerCase();
            return (
              <tr
                key={i}
                className={`border-t border-[#2a2a3a] ${
                  isYou ? "bg-[var(--accent-purple)]/20" : ""
                }`}
              >
                <td className="px-4 py-2">{i + 1}</td>
                <td className="px-4 py-2 font-mono">
                  {shorten(row.address)}
                  {isYou && (
                    <span className="ml-2 text-[var(--accent-purple)]">(You)</span>
                  )}
                </td>
                <td className="px-4 py-2">{row.rp ?? 0}</td>
                <td className="px-4 py-2">
                  {RANK_NAMES[row.rank ?? rpToRank(row.rp ?? 0)] ?? RANK_NAMES[0]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {list.length === 0 && (
        <p className="text-center text-[var(--text-secondary)] py-6">
          No leaderboard data yet.
        </p>
      )}
    </div>
  );
}
