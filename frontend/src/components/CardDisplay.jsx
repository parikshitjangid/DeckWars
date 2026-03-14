import React from "react";
import RarityBadge from "./RarityBadge";

const rarityClass = {
  0: "rarity-common",
  1: "rarity-uncommon",
  2: "rarity-rare",
  3: "rarity-epic",
  4: "rarity-legendary",
};

const elementClass = {
  0: "card-fire",
  1: "card-water",
  2: "card-earth",
};

const elementIcon = {
  0: "🔥",
  1: "💧",
  2: "🌍",
};

const elementName = {
  0: "Fire",
  1: "Water",
  2: "Earth",
};

export default function CardDisplay({
  cardId,
  cardData,
  ownedCount = 0,
  onClick,
  selected = false,
}) {
  if (!cardData) return null;
  const { name, attack, defense, element, rarity } = cardData;
  const baseClasses = [
    "card-base",
    elementClass[element] || "",
    rarityClass[rarity] || "",
    ownedCount === 0 ? "opacity-40 grayscale" : "",
    selected ? "ring-2 ring-[var(--accent-purple)] ring-offset-2 ring-offset-[#0a0a0f]" : "",
  ].join(" ");

  return (
    <button
      type="button"
      onClick={onClick}
      className={baseClasses}
    >
      <div className="flex flex-col h-[220px] w-[160px] justify-between">
        <div className="flex justify-between items-start">
          <span className="text-2xl">{elementIcon[element]}</span>
          <span className="text-xs text-[var(--text-secondary)]">
            #{cardId}
          </span>
        </div>
        <div className="mt-2">
          <h3 className="text-sm font-semibold truncate">{name}</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            ATK {attack} | DEF {defense}
          </p>
        </div>
        <div className="flex items-center justify-between mt-3 text-xs">
          <span>{elementName[element]}</span>
          <RarityBadge rarity={rarity} />
        </div>
        <div className="mt-1 text-right text-[10px] text-[var(--text-secondary)]">
          Owned: {ownedCount}
        </div>
      </div>
    </button>
  );
}

