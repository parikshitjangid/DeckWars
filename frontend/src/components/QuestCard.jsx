import React from "react";

export default function QuestCard({
  name,
  description,
  goal,
  progress,
  rewardCardId,
  claimed,
  onClaim,
  onCheckCollector,
  isCollector,
  isLoading,
}) {
  const complete = progress >= goal;
  const canClaim = complete && !claimed;

  return (
    <div className="rounded-lg bg-[#12121a] border border-[#2a2a3a] p-4 flex flex-col">
      <h3 className="font-semibold">{name}</h3>
      <p className="text-sm text-[var(--text-secondary)] mt-1">{description}</p>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-2 bg-[#1a1a2e] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent-purple)] rounded-full transition-all"
            style={{ width: `${Math.min(100, goal ? (progress / goal) * 100 : 0)}%` }}
          />
        </div>
        <span className="text-xs text-[var(--text-secondary)]">
          {progress} / {goal}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs">Reward: Card #{rewardCardId}</span>
        {claimed ? (
          <span className="text-green-400 text-sm">✓ Claimed</span>
        ) : canClaim ? (
          <button
            onClick={onClaim}
            disabled={isLoading}
            className="rounded-md bg-[var(--accent-purple)] px-3 py-1 text-sm font-medium disabled:opacity-50"
          >
            Claim Reward
          </button>
        ) : isCollector ? (
          <button
            onClick={onCheckCollector}
            disabled={isLoading}
            className="rounded-md bg-[#1a1a2e] px-3 py-1 text-sm"
          >
            Check Collection
          </button>
        ) : null}
      </div>
    </div>
  );
}
