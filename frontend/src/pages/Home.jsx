import React from "react";
import { useAccount, useReadContract } from "wagmi";
import { useCards } from "../hooks/useCards";
import { CONTRACT_ADDRESSES, ABIS } from "../contracts";
import LoadingSpinner from "../components/LoadingSpinner";
import CardDisplay from "../components/CardDisplay";

function useSeasonStats() {
  const { data: totalBattles, isLoading: battlesLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsBattle,
    abi: ABIS.DeckWarsBattle,
    functionName: "totalBattles",
  });

  const { data: timeRemaining, isLoading: timeLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsSeason,
    abi: ABIS.DeckWarsSeason,
    functionName: "timeRemaining",
  });

  const { data: currentSeason } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsSeason,
    abi: ABIS.DeckWarsSeason,
    functionName: "getCurrentSeason",
  });

  const { data: name } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsSeason,
    abi: ABIS.DeckWarsSeason,
    functionName: "getSeasonName",
    args: currentSeason ? [currentSeason] : undefined,
    query: { enabled: !!currentSeason },
  });

  return {
    totalBattles: totalBattles ? Number(totalBattles) : 0,
    timeRemaining: timeRemaining ? Number(timeRemaining) : 0,
    currentSeasonName: name || "Loading...",
    isLoading: battlesLoading || timeLoading,
  };
}

function formatDuration(seconds) {
  const s = Math.max(0, seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

export default function Home() {
  const { isConnected } = useAccount();
  const { cards, mintStarterPack, hasMintedStarter, isLoading } = useCards();
  const { totalBattles, currentSeasonName, timeRemaining, isLoading: statsLoading } =
    useSeasonStats();

  const featuredIds = [4, 20, 6];

  if (!isConnected) {
    return (
      <div className="mt-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">DeckWars</h1>
        <p className="text-[var(--text-secondary)] mb-6">
          Battle. Craft. Conquer. Fully Onchain.
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          Connect your wallet using the button in the top right to begin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="text-center mt-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">DeckWars</h1>
        <p className="text-[var(--text-secondary)] mb-6">
          Battle. Craft. Conquer. Fully Onchain.
        </p>
        <button
          onClick={mintStarterPack}
          disabled={isLoading || hasMintedStarter}
          className="inline-flex items-center justify-center rounded-lg bg-[var(--accent-purple)] px-6 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-50"
        >
          {hasMintedStarter ? "Starter Pack Claimed" : "Get Starter Cards (Free)"}
        </button>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-[#12121a] rounded-xl p-4">
        {statsLoading ? (
          <div className="col-span-4">
            <LoadingSpinner label="Loading live stats..." />
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Total Battles Fought</p>
              <p className="text-2xl font-bold mt-1">{totalBattles}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Total Cards Owned</p>
              <p className="text-2xl font-bold mt-1">
                {cards.reduce((sum, c) => sum + c.balance, 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Current Season</p>
              <p className="text-base font-semibold mt-1">{currentSeasonName}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Season Time Remaining</p>
              <p className="text-base font-semibold mt-1">
                {formatDuration(timeRemaining)}
              </p>
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Featured Cards</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {featuredIds.map((id) => (
            <CardDisplay
              key={id}
              cardId={id}
              cardData={{
                name: id === 4 ? "InfernoPhoenix" : id === 20 ? "AbyssalLord" : "CrystalDrake",
                attack: id === 4 ? 10 : id === 20 ? 10 : 8,
                defense: id === 4 ? 4 : id === 20 ? 7 : 8,
                element: id === 4 ? 0 : id === 20 ? 1 : 2,
                rarity: id === 6 ? 3 : 4,
              }}
              ownedCount={cards.find((c) => c.id === id)?.balance || 0}
            />
          ))}
        </div>
      </section>

      <section className="bg-[#12121a] rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-2">How to Play</h2>
        <ol className="space-y-2 text-sm text-[var(--text-secondary)]">
          <li>1. Get Cards — Mint your free starter pack.</li>
          <li>2. Build Deck — Head to the Deck Builder and save a 20-card deck onchain.</li>
          <li>3. Battle — Challenge another player in the Battle Arena.</li>
          <li>4. Earn Rewards — Complete quests, climb the leaderboard, and claim season rewards.</li>
        </ol>
      </section>
    </div>
  );
}

