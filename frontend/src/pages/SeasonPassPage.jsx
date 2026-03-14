import React from "react";
import { useSeasonPass } from "../hooks/useSeasonPass";
import { useCards } from "../hooks/useCards";
import CardDisplay from "../components/CardDisplay";
import LoadingSpinner from "../components/LoadingSpinner";

const MILESTONES = [
  { level: 10, reward: "Uncommon card (ID 3)" },
  { level: 20, reward: "Rare card (ID 2)" },
  { level: 30, reward: "Rare card (ID 15)" },
  { level: 40, reward: "5 HLUSD" },
  { level: 50, reward: "Epic card (ID 6)" },
  { level: 75, reward: "10 HLUSD" },
  { level: 100, reward: "Legendary card (ID 20) + Season Master badge" },
];

export default function SeasonPassPage() {
  const { hasPass, level, purchase, claimMilestone, isLoading } = useSeasonPass();
  const { cards } = useCards();

  const cardForId = (id) => cards.find((c) => c.id === id)?.data;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Season Pass</h1>

      {!hasPass ? (
        <div className="rounded-lg bg-[#12121a] border border-[#2a2a3a] p-6">
          <h2 className="text-lg font-semibold mb-4">Benefits</h2>
          <ul className="space-y-2 text-sm text-[var(--text-secondary)] mb-6">
            <li>✓ Exclusive Pass card (Rare)</li>
            <li>✓ Veteran badge NFT</li>
            <li>✓ Golden card border cosmetic</li>
            <li>✓ 2× HLUSD on all quest rewards</li>
          </ul>
          <button
            onClick={purchase}
            disabled={isLoading}
            className="rounded-lg bg-[var(--accent-gold)] text-[#0a0a0f] px-6 py-2 font-semibold disabled:opacity-50"
          >
            Buy Season Pass (10 HLUSD)
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-lg bg-[#12121a] border border-[#2a2a3a] p-4">
            <p className="text-[var(--text-secondary)]">Your level</p>
            <p className="text-2xl font-bold">{level}</p>
            <div className="mt-2 h-3 bg-[#1a1a2e] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent-gold)] rounded-full transition-all"
                style={{ width: `${Math.min(100, level)}%` }}
              />
            </div>
          </div>

          <section>
            <h2 className="text-lg font-semibold mb-4">Milestones</h2>
            <div className="flex flex-wrap gap-4">
              {MILESTONES.map(({ level: lvl, reward }) => {
                const reached = level >= lvl;
                return (
                  <div
                    key={lvl}
                    className={`rounded-lg border p-4 min-w-[140px] ${
                      reached
                        ? "border-[var(--accent-gold)] bg-amber-900/20"
                        : "border-[#2a2a3a] bg-[#12121a] opacity-70"
                    }`}
                  >
                    <p className="font-mono text-sm">Level {lvl}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {reward}
                    </p>
                    {reached && (
                      <button
                        onClick={() => claimMilestone(lvl)}
                        disabled={isLoading}
                        className="mt-2 rounded bg-[var(--accent-purple)] px-2 py-1 text-xs disabled:opacity-50"
                      >
                        Claim
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
