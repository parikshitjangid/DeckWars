import React from "react";

const rarityMap = {
  0: { label: "Common", color: "text-[var(--common-color)]" },
  1: { label: "Uncommon", color: "text-[var(--uncommon-color)]" },
  2: { label: "Rare", color: "text-[var(--rare-color)]" },
  3: { label: "Epic", color: "text-[var(--epic-color)]" },
  4: { label: "Legendary", color: "text-[var(--legendary-color)]" },
};

export default function RarityBadge({ rarity }) {
  const cfg = rarityMap[rarity] || rarityMap[0];
  return (
    <span
      className={`px-2 py-0.5 rounded-full border border-current text-[10px] font-semibold ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
}

