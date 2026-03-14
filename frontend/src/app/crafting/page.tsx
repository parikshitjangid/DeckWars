'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import Card from '@/components/Card';
import { ALL_CARDS, type CardData, type CardRarity } from '@/config/wagmi';
import { useCraft, useContractsReady, useAllCardBalances } from '@/hooks/useContracts';

const RECIPES: { input: CardRarity; output: CardRarity; label: string }[] = [
  { input: 'Common',  output: 'Rare',      label: '3× Common → 1× Rare' },
  { input: 'Rare',    output: 'Epic',       label: '3× Rare → 1× Epic' },
  { input: 'Epic',    output: 'Legendary',  label: '3× Epic → 1× Legendary' },
];

export default function CraftingPage() {
  const [selectedRecipe, setSelectedRecipe] = useState(0);
  const [selectedCards, setSelectedCards] = useState<CardData[]>([]);
  const [craftResult, setCraftResult] = useState<CardData | null>(null);
  const [crafting, setCrafting] = useState(false);
  const { isConnected } = useAccount();
  const contractsReady = useContractsReady();
  const { craft: craftOnChain, isPending, isConfirming, isSuccess, error } = useCraft();
  const balanceResults = useAllCardBalances();

  const recipe = RECIPES[selectedRecipe];
  const availableCards = ALL_CARDS.filter((c) => c.rarity === recipe.input);
  const outputCards = ALL_CARDS.filter((c) => c.rarity === recipe.output);

  // Build owned map
  const owned: Record<number, number> = {};
  ALL_CARDS.forEach((card, i) => {
    if (contractsReady && balanceResults[i]?.data !== undefined) {
      owned[card.id] = Number(balanceResults[i].data);
    } else {
      owned[card.id] = 3; // demo
    }
  });

  const toggleCard = (card: CardData) => {
    const idx = selectedCards.findIndex((c) => c.id === card.id);
    if (idx >= 0) {
      setSelectedCards((prev) => prev.filter((_, i) => i !== idx));
    } else if (selectedCards.length < 3) {
      setSelectedCards((prev) => [...prev, card]);
    }
  };

  const handleCraft = () => {
    if (selectedCards.length !== 3) return;

    if (contractsReady && isConnected) {
      // Real on-chain craft
      craftOnChain(selectedCards.map((c) => c.id));
      setCraftResult(null);
    } else {
      // Demo craft
      setCrafting(true);
      setCraftResult(null);
      setTimeout(() => {
        const result = outputCards[Math.floor(Math.random() * outputCards.length)];
        setCraftResult(result);
        setCrafting(false);
        setSelectedCards([]);
      }, 2000);
    }
  };

  // Handle on-chain success
  if (isSuccess && !craftResult) {
    const result = outputCards[Math.floor(Math.random() * outputCards.length)];
    setCraftResult(result);
    setSelectedCards([]);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-3xl font-bold mb-6">
        <span className="mr-2">🔨</span> Crafting
        {!contractsReady && <span className="ml-3 text-yellow-500/70 text-xs font-normal">(demo mode)</span>}
      </h1>

      {/* Recipe tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto">
        {RECIPES.map((r, i) => (
          <button
            key={i}
            onClick={() => { setSelectedRecipe(i); setSelectedCards([]); setCraftResult(null); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
              selectedRecipe === i
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Crafting area */}
      <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-8">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          {/* 3 input slots */}
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative">
              {selectedCards[i] ? (
                <div className="relative" onClick={() => setSelectedCards(prev => prev.filter((_, idx) => idx !== i))}>
                  <Card card={selectedCards[i]} size="sm" />
                  <div className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px] cursor-pointer">
                    ✕
                  </div>
                </div>
              ) : (
                <div className="w-28 h-40 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center">
                  <span className="text-gray-600 text-sm">Slot {i + 1}</span>
                </div>
              )}
            </div>
          ))}

          <div className="text-3xl text-gray-500 px-2">→</div>

          {/* Result */}
          <div className="relative">
            {(crafting || isPending || isConfirming) ? (
              <div className="w-28 h-40 rounded-xl bg-gradient-to-br from-purple-500/30 to-orange-500/30 flex flex-col items-center justify-center border border-white/20">
                <div className="animate-spin text-3xl">✨</div>
                {isPending && <p className="text-xs text-yellow-400 mt-2">Confirm in wallet</p>}
                {isConfirming && <p className="text-xs text-cyan-400 mt-2">On-chain...</p>}
              </div>
            ) : craftResult ? (
              <div className="victory-pop">
                <Card card={craftResult} size="sm" />
              </div>
            ) : (
              <div className="w-28 h-40 rounded-xl border-2 border-dashed border-orange-500/30 flex items-center justify-center bg-orange-500/5">
                <span className="text-orange-400/50 text-sm text-center px-2">{recipe.output}</span>
              </div>
            )}
          </div>
        </div>

        {/* Transaction status */}
        {error && (
          <div className="text-center mt-4 text-red-400 text-xs">
            ❌ {error.message?.slice(0, 100)}
          </div>
        )}
        {isSuccess && craftResult && (
          <div className="text-center mt-4 text-green-400 text-sm font-bold">
            ✅ Crafted on-chain! You received: {craftResult.name}
          </div>
        )}

        {/* Craft Button */}
        <div className="text-center mt-6">
          <button
            onClick={handleCraft}
            disabled={selectedCards.length !== 3 || crafting || isPending || isConfirming}
            className={`px-8 py-3 rounded-xl font-bold transition-all cursor-pointer ${
              selectedCards.length === 3 && !crafting && !isPending && !isConfirming
                ? 'bg-gradient-to-r from-purple-500 to-orange-500 text-white hover:shadow-lg hover:shadow-purple-500/25'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isPending ? '⏳ Confirm in wallet...' :
             isConfirming ? '⛓️ Crafting on-chain...' :
             crafting ? '✨ Crafting...' :
             `🔨 Craft ${recipe.output}`}
          </button>
        </div>
      </div>

      {/* Available cards */}
      <h2 className="text-lg font-semibold text-gray-300 mb-3">
        Available {recipe.input} Cards
        {contractsReady && <span className="text-xs text-gray-500 ml-2">(showing your on-chain balance)</span>}
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {availableCards.map((card) => (
          <Card
            key={card.id}
            card={card}
            size="sm"
            selected={selectedCards.some((c) => c.id === card.id)}
            onClick={() => toggleCard(card)}
            owned={owned[card.id]}
            showOwned
          />
        ))}
      </div>
    </div>
  );
}
