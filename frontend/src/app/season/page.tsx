'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import {
  usePlayerStats, useClaimQuest, useVoteCard, useContractsReady,
} from '@/hooks/useContracts';

const DEMO_QUESTS = [
  { id: 0, name: 'Battle Master',   desc: 'Win 5 battles',         progress: 3, target: 5,  reward: '50 RP' },
  { id: 1, name: 'Crafter',         desc: 'Craft 3 cards',         progress: 1, target: 3,  reward: '30 RP' },
  { id: 2, name: 'Collector',       desc: 'Own 10 unique cards',   progress: 7, target: 10, reward: 'Rare Pack' },
  { id: 3, name: 'Elemental Master',desc: 'Win with each element', progress: 2, target: 3,  reward: 'Epic Card' },
  { id: 4, name: 'Champion',        desc: 'Reach Gold rank',       progress: 0, target: 1,  reward: 'Legendary Card' },
];

const DEMO_LEADERBOARD = [
  { rank: 1, name: '0xAb...3F21', rp: 2450, tier: 'Legend' },
  { rank: 2, name: '0x7C...E892', rp: 2100, tier: 'Diamond' },
  { rank: 3, name: '0x1D...4A56', rp: 1850, tier: 'Diamond' },
  { rank: 4, name: '0xBf...C7D0', rp: 1600, tier: 'Platinum' },
  { rank: 5, name: '0x92...F1AB', rp: 1420, tier: 'Platinum' },
  { rank: 6, name: '0x5E...89C3', rp: 1200, tier: 'Gold' },
  { rank: 7, name: '0xD3...6E78', rp: 980,  tier: 'Gold' },
  { rank: 8, name: '0x4A...B012', rp: 750,  tier: 'Silver' },
  { rank: 9, name: '0x8F...34D5', rp: 520,  tier: 'Silver' },
  { rank: 10, name: '0xC1...A9E6', rp: 310, tier: 'Bronze' },
];

const TIER_COLORS: Record<string, string> = {
  Legend:   'text-amber-400',
  Diamond:  'text-cyan-300',
  Platinum: 'text-purple-300',
  Gold:     'text-yellow-400',
  Silver:   'text-gray-300',
  Bronze:   'text-orange-600',
};

const DAO_CARDS = [
  { id: 16, name: 'Phoenix King', votes: 142 },
  { id: 17, name: "Poseidon's Wrath", votes: 98 },
  { id: 18, name: 'Gaia Empress', votes: 87 },
];

export default function SeasonPage() {
  const [tab, setTab] = useState<'quests' | 'leaderboard' | 'vote'>('quests');
  const [voted, setVoted] = useState<number | null>(null);
  const { isConnected, address } = useAccount();
  const contractsReady = useContractsReady();
  const playerStats = usePlayerStats();
  const { claim, isPending: isClaimPending } = useClaimQuest();
  const { vote, isPending: isVotePending } = useVoteCard();

  // Parse on-chain player stats if available
  const stats = playerStats.data ? {
    totalRP: Number((playerStats.data as any[])[0]),
    seasonRP: Number((playerStats.data as any[])[1]),
    wins: Number((playerStats.data as any[])[2]),
    losses: Number((playerStats.data as any[])[3]),
  } : null;

  const daysLeft = 18;

  const handleClaimQuest = (questId: number) => {
    if (contractsReady && isConnected) {
      claim(BigInt(1), BigInt(questId));
    } else {
      alert('Connect wallet & deploy contracts to claim rewards on-chain!');
    }
  };

  const handleVote = (cardId: number) => {
    if (contractsReady && isConnected) {
      vote(BigInt(cardId));
    }
    setVoted(cardId);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="mr-2">🏆</span> Season 1
            {!contractsReady && <span className="ml-3 text-yellow-500/70 text-xs font-normal">(demo mode)</span>}
          </h1>
          {stats && (
            <p className="text-gray-500 text-sm mt-1">
              Your RP: <span className="text-orange-400 font-bold">{stats.seasonRP}</span> •
              W/L: <span className="text-green-400">{stats.wins}</span>/<span className="text-red-400">{stats.losses}</span>
            </p>
          )}
        </div>
        <div className="bg-white/5 rounded-xl px-4 py-2 border border-white/5 text-sm">
          <span className="text-gray-400">Ends in </span>
          <span className="text-orange-400 font-bold">{daysLeft} days</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6">
        {(['quests', 'leaderboard', 'vote'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize cursor-pointer ${
              tab === t
                ? 'bg-orange-500/20 text-orange-300'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t === 'quests' ? '📜 Quests' : t === 'leaderboard' ? '🏅 Leaderboard' : '🗳️ DAO Vote'}
          </button>
        ))}
      </div>

      {/* ── Quests Tab ────────────────────────────────────── */}
      {tab === 'quests' && (
        <div className="space-y-3">
          {DEMO_QUESTS.map((quest) => {
            const pct = Math.min(100, (quest.progress / quest.target) * 100);
            const done = quest.progress >= quest.target;
            return (
              <div key={quest.id} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-white font-bold text-sm">{quest.name}</h3>
                    <p className="text-gray-500 text-xs">{quest.desc}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500 text-xs">Reward</span>
                    <p className="text-orange-400 font-bold text-sm">{quest.reward}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-green-500' : 'bg-orange-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">
                    {quest.progress}/{quest.target}
                  </span>
                  {done && (
                    <button
                      onClick={() => handleClaimQuest(quest.id)}
                      disabled={isClaimPending}
                      className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-lg hover:bg-green-500/30 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isClaimPending ? '⏳' : '🎁'} Claim
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Leaderboard Tab ───────────────────────────────── */}
      {tab === 'leaderboard' && (
        <div>
          {/* Your rank card */}
          {isConnected && stats && (
            <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/20 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-400 text-xs font-bold">Your Stats</p>
                  <p className="text-white font-bold">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-xl">{stats.seasonRP} RP</p>
                  <p className="text-gray-400 text-xs">{stats.wins}W / {stats.losses}L</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
            <div className="grid grid-cols-4 text-xs text-gray-500 font-medium p-3 border-b border-white/5">
              <span>Rank</span>
              <span>Player</span>
              <span className="text-right">RP</span>
              <span className="text-right">Tier</span>
            </div>
            {DEMO_LEADERBOARD.map((entry) => (
              <div key={entry.rank} className="grid grid-cols-4 items-center p-3 text-sm border-b border-white/[0.03] hover:bg-white/5 transition-colors">
                <span className={`font-bold ${entry.rank <= 3 ? 'text-amber-400' : 'text-gray-400'}`}>
                  {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                </span>
                <span className="text-gray-300 font-mono text-xs">{entry.name}</span>
                <span className="text-right text-white font-bold">{entry.rp.toLocaleString()}</span>
                <span className={`text-right font-bold text-xs ${TIER_COLORS[entry.tier]}`}>
                  {entry.tier}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DAO Vote Tab ──────────────────────────────────── */}
      {tab === 'vote' && (
        <div>
          <p className="text-gray-400 text-sm mb-6">
            Vote for next season&apos;s featured card! The winning card will receive bonus drop rates.
            {contractsReady && <span className="text-green-400 ml-1">(on-chain voting)</span>}
          </p>
          <div className="space-y-3">
            {DAO_CARDS.map((card) => {
              const totalVotes = DAO_CARDS.reduce((sum, c) => sum + c.votes, 0);
              const pct = Math.round((card.votes / totalVotes) * 100);
              const isVoted = voted === card.id;
              return (
                <div key={card.id} className={`bg-white/5 rounded-xl p-4 border transition-all ${
                  isVoted ? 'border-orange-500/30 bg-orange-500/5' : 'border-white/5'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-white font-bold">{card.name}</h3>
                      <p className="text-gray-500 text-xs">Card #{card.id}</p>
                    </div>
                    <button
                      onClick={() => handleVote(card.id)}
                      disabled={voted !== null || isVotePending}
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                        isVoted
                          ? 'bg-orange-500 text-black'
                          : voted !== null
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-white/10 text-white hover:bg-orange-500/20 hover:text-orange-300'
                      }`}
                    >
                      {isVotePending ? '⏳' : isVoted ? '✓ Voted' : 'Vote'}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{card.votes} votes ({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
