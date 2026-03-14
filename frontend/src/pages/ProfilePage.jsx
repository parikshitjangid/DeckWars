import React from "react";
import { useAccount } from "wagmi";
import { useRank } from "../hooks/useRank";
import { useCards } from "../hooks/useCards";
import toast from "react-hot-toast";

function shorten(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ProfilePage() {
  const { address } = useAccount();
  const { stats, rankName } = useRank();
  const { cards } = useCards();

  const totalCards = cards.reduce((sum, c) => sum + c.balance, 0);
  const cardTypes = cards.filter((c) => c.balance > 0).length;
  const winRate =
    stats && stats.wins + stats.losses > 0
      ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)
      : "0";

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    toast.success("Address copied!");
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Profile</h1>

      <div className="rounded-lg bg-[#12121a] border border-[#2a2a3a] p-6">
        <p className="text-xs text-[var(--text-secondary)] mb-1">Wallet</p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg break-all">{address}</span>
          <button
            onClick={copyAddress}
            className="rounded bg-[#1a1a2e] px-2 py-1 text-xs hover:bg-[#2a2a3a]"
          >
            Copy
          </button>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-lg bg-[#12121a] p-4 border border-[#2a2a3a]">
            <p className="text-xs text-[var(--text-secondary)]">Total Wins</p>
            <p className="text-xl font-bold">{stats?.wins ?? 0}</p>
          </div>
          <div className="rounded-lg bg-[#12121a] p-4 border border-[#2a2a3a]">
            <p className="text-xs text-[var(--text-secondary)]">Total Losses</p>
            <p className="text-xl font-bold">{stats?.losses ?? 0}</p>
          </div>
          <div className="rounded-lg bg-[#12121a] p-4 border border-[#2a2a3a]">
            <p className="text-xs text-[var(--text-secondary)]">Win Rate</p>
            <p className="text-xl font-bold">{winRate}%</p>
          </div>
          <div className="rounded-lg bg-[#12121a] p-4 border border-[#2a2a3a]">
            <p className="text-xs text-[var(--text-secondary)]">Current RP</p>
            <p className="text-xl font-bold">{stats?.rankPoints ?? 0}</p>
          </div>
          <div className="rounded-lg bg-[#12121a] p-4 border border-[#2a2a3a]">
            <p className="text-xs text-[var(--text-secondary)]">Rank</p>
            <p className="text-xl font-bold">{rankName}</p>
          </div>
          <div className="rounded-lg bg-[#12121a] p-4 border border-[#2a2a3a]">
            <p className="text-xs text-[var(--text-secondary)]">Cards Owned</p>
            <p className="text-xl font-bold">
              {totalCards} <span className="text-sm font-normal">({cardTypes} types)</span>
            </p>
          </div>
        </div>
      </section>

      <div>
        <button
          onClick={() => {
            const url = window.location.origin + "/profile";
            navigator.clipboard.writeText(url);
            toast.success("Profile link copied!");
          }}
          className="rounded-lg bg-[var(--accent-purple)] px-4 py-2 text-sm font-semibold"
        >
          Share Profile
        </button>
      </div>
    </div>
  );
}
