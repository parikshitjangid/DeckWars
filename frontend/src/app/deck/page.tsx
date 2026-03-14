'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import Card from '@/components/Card';
import { ALL_CARDS, type CardData } from '@/config/wagmi';
import { useRegisterDeck, useContractsReady, useAllCardBalances } from '@/hooks/useContracts';

const DECK_SIZE = 20;

export default function DeckPage() {
  const [deck, setDeck] = useState<CardData[]>([]);
  const [deckName, setDeckName] = useState('My Deck');
  const { isConnected } = useAccount();
  const contractsReady = useContractsReady();
  const { registerDeck, isPending, isConfirming, isSuccess, error } = useRegisterDeck();
  const balanceResults = useAllCardBalances();

  // Build owned map
  const ownedCards: Record<number, number> = {};
  ALL_CARDS.forEach((card, i) => {
    if (contractsReady && balanceResults[i]?.data !== undefined) {
      ownedCards[card.id] = Number(balanceResults[i].data);
    } else {
      ownedCards[card.id] = 99; // demo: unlimited
    }
  });

  const toggleCard = (card: CardData) => {
    const idx = deck.findIndex((c) => c.id === card.id);
    if (idx >= 0) {
      setDeck((prev) => prev.filter((_, i) => i !== idx));
    } else if (deck.length < DECK_SIZE) {
      setDeck((prev) => [...prev, card]);
    }
  };

  const isSelected = (id: number) => deck.some((c) => c.id === id);

  const elementCounts = deck.reduce(
    (acc, c) => ({ ...acc, [c.element]: (acc[c.element] || 0) + 1 }),
    {} as Record<string, number>
  );

  const avgEnergy = deck.length > 0
    ? (deck.reduce((sum, c) => sum + c.energyCost, 0) / deck.length).toFixed(1)
    : '0.0';

  const handleSave = () => {
    if (deck.length !== DECK_SIZE) return;
    if (contractsReady && isConnected) {
      registerDeck(deck.map((c) => c.id));
    } else {
      alert('Connect your wallet and deploy contracts first to save on-chain!');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-3xl font-bold mb-6">
        <span className="mr-2">📋</span> Deck Builder
        {!contractsReady && (
          <span className="ml-3 text-yellow-500/70 text-xs font-normal">(demo mode)</span>
        )}
      </h1>

      <div className="grid md:grid-cols-3 gap-6">
        {/* ── Left: Card selector ────────────── */}
        <div className="md:col-span-2">
          <h2 className="text-lg font-semibold mb-3 text-gray-300">Available Cards</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {ALL_CARDS.map((card) => (
              <Card
                key={card.id}
                card={card}
                size="sm"
                selected={isSelected(card.id)}
                onClick={() => toggleCard(card)}
                owned={ownedCards[card.id]}
              />
            ))}
          </div>
        </div>

        {/* ── Right: Deck panel ──────────────── */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-4 h-fit sticky top-20">
          <div className="flex items-center justify-between mb-4">
            <input
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              className="bg-transparent text-lg font-bold text-white border-b border-white/10 focus:border-orange-400 outline-none w-full mr-2 transition-colors"
            />
            <span className={`text-sm font-bold ${deck.length === DECK_SIZE ? 'text-green-400' : 'text-orange-400'}`}>
              {deck.length}/{DECK_SIZE}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-red-400 text-xs">🔥 Fire</div>
              <div className="text-white font-bold">{elementCounts.Fire || 0}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-cyan-400 text-xs">💧 Water</div>
              <div className="text-white font-bold">{elementCounts.Water || 0}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-green-400 text-xs">🪨 Earth</div>
              <div className="text-white font-bold">{elementCounts.Earth || 0}</div>
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-2 mb-4 text-center">
            <div className="text-yellow-400 text-xs">⚡ Avg Energy Cost</div>
            <div className="text-white font-bold">{avgEnergy}</div>
          </div>

          {/* Deck list */}
          <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
            {deck.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                Tap cards to add them to your deck
              </p>
            ) : (
              deck.map((card, i) => (
                <div
                  key={`${card.id}-${i}`}
                  className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-sm hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => {
                    setDeck((prev) => prev.filter((_, idx) => idx !== i));
                  }}
                >
                  <span className="text-gray-300">
                    <span className="mr-1">{card.element === 'Fire' ? '🔥' : card.element === 'Water' ? '💧' : '🪨'}</span>
                    {card.name}
                  </span>
                  <span className="text-gray-500 text-xs">⚡{card.energyCost}</span>
                </div>
              ))
            )}
          </div>

          {/* Transaction states */}
          {isPending && (
            <div className="mt-3 text-center text-yellow-400 text-xs animate-pulse">
              ⏳ Confirm in your wallet...
            </div>
          )}
          {isConfirming && (
            <div className="mt-3 text-center text-cyan-400 text-xs animate-pulse">
              ⛓️ Confirming on chain...
            </div>
          )}
          {isSuccess && (
            <div className="mt-3 text-center text-green-400 text-xs">
              ✅ Deck saved on-chain!
            </div>
          )}
          {error && (
            <div className="mt-3 text-center text-red-400 text-xs truncate">
              ❌ {error.message?.slice(0, 80)}...
            </div>
          )}

          {/* Save button */}
          <button
            disabled={deck.length !== DECK_SIZE || isPending || isConfirming}
            onClick={handleSave}
            className={`w-full mt-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              deck.length === DECK_SIZE && !isPending && !isConfirming
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-black hover:shadow-lg hover:shadow-orange-500/25 cursor-pointer'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isPending ? '⏳ Confirming...' :
             isConfirming ? '⛓️ On-Chain...' :
             deck.length === DECK_SIZE ? '💾 Save Deck On-Chain' : `Need ${DECK_SIZE - deck.length} more cards`}
          </button>
        </div>
      </div>
    </div>
  );
}
