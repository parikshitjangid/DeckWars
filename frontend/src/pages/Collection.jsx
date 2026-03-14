import React, { useMemo, useState } from "react";
import { useCards } from "../hooks/useCards";
import CardDisplay from "../components/CardDisplay";
import LoadingSpinner from "../components/LoadingSpinner";

const FILTERS = {
  all: () => true,
  fire: (c) => c.data?.element === 0,
  water: (c) => c.data?.element === 1,
  earth: (c) => c.data?.element === 2,
  common: (c) => c.data?.rarity === 0,
  uncommon: (c) => c.data?.rarity === 1,
  rare: (c) => c.data?.rarity === 2,
  epic: (c) => c.data?.rarity === 3,
  legendary: (c) => c.data?.rarity === 4,
};

const SORTS = {
  rarity: (a, b) => (b.data?.rarity ?? 0) - (a.data?.rarity ?? 0),
  element: (a, b) => (a.data?.element ?? 0) - (b.data?.element ?? 0),
  attack: (a, b) => (b.data?.attack ?? 0) - (a.data?.attack ?? 0),
  defense: (a, b) => (b.data?.defense ?? 0) - (a.data?.defense ?? 0),
};

export default function Collection() {
  const { cards, isLoading, mintStarterPack, hasMintedStarter } = useCards();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("rarity");

  const filtered = useMemo(() => {
    const list = cards.filter(FILTERS[filter] || FILTERS.all);
    return [...list].sort(SORTS[sort] || SORTS.rarity);
  }, [cards, filter, sort]);

  const totalOwned = useMemo(
    () => cards.reduce((sum, c) => sum + c.balance, 0),
    [cards]
  );

  if (isLoading && cards.length === 0) {
    return (
      <div className="py-8">
        <LoadingSpinner label="Loading collection..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">My Collection</h1>
        {totalOwned === 0 && (
          <button
            onClick={mintStarterPack}
            disabled={isLoading || hasMintedStarter}
            className="rounded-lg bg-[var(--accent-purple)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Mint Starter Pack
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.keys(FILTERS).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-md px-3 py-1 text-sm capitalize ${
              filter === key
                ? "bg-[var(--accent-purple)] text-white"
                : "bg-[#1a1a2e] text-[var(--text-secondary)] hover:text-white"
            }`}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-[var(--text-secondary)]">Sort:</span>
        {Object.keys(SORTS).map((key) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={`rounded-md px-3 py-1 text-sm capitalize ${
              sort === key
                ? "bg-[var(--accent-purple)] text-white"
                : "bg-[#1a1a2e] text-[var(--text-secondary)]"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filtered.map((card) => (
          <CardDisplay
            key={card.id}
            cardId={card.id}
            cardData={card.data}
            ownedCount={card.balance}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-center text-[var(--text-secondary)] py-8">
          No cards match the filter. Mint a starter pack to get started.
        </p>
      )}
    </div>
  );
}
