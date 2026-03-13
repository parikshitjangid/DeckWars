'use client';

import { useState } from 'react';
import Card from '@/components/Card';
import { ALL_CARDS, type CardData, type CardRarity, RARITY_COLORS } from '@/config/wagmi';

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

  const recipe = RECIPES[selectedRecipe];
  const availableCards = ALL_CARDS.filter((c) => c.rarity === recipe.input);
  const outputCards = ALL_CARDS.filter((c) => c.rarity === recipe.output);

  const toggleCard = (card: CardData) => {
    const idx = selectedCards.findIndex((c) => c.id === card.id);
    if (idx >= 0) {
      setSelectedCards((prev) => prev.filter((_, i) => i !== idx));
    } else if (selectedCards.length < 3) {
      setSelectedCards((prev) => [...prev, card]);
    }
  };

  const craft = () => {
    if (selectedCards.length !== 3) return;
    setCrafting(true);
    setCraftResult(null);

    // Simulate crafting animation
    setTimeout(() => {
      const result = outputCards[Math.floor(Math.random() * outputCards.length)];
      setCraftResult(result);
      setCrafting(false);
      setSelectedCards([]);
    }, 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-3xl font-bold mb-6">
        <span className="mr-2">🔨</span> Crafting
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

          {/* Arrow */}
          <div className="text-3xl text-gray-500 px-2">→</div>

          {/* Result */}
          <div className="relative">
            {crafting ? (
              <div className="w-28 h-40 rounded-xl bg-gradient-to-br from-purple-500/30 to-orange-500/30 flex items-center justify-center border border-white/20">
                <div className="animate-spin text-3xl">✨</div>
              </div>
            ) : craftResult ? (
              <div className="victory-pop">
                <Card card={craftResult} size="sm" />
              </div>
            ) : (
              <div className="w-28 h-40 rounded-xl border-2 border-dashed border-orange-500/30 flex items-center justify-center bg-orange-500/5">
                <span className="text-orange-400/50 text-sm text-center px-2">
                  {recipe.output}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Craft Button */}
        <div className="text-center mt-6">
          <button
            onClick={craft}
            disabled={selectedCards.length !== 3 || crafting}
            className={`px-8 py-3 rounded-xl font-bold transition-all cursor-pointer ${
              selectedCards.length === 3 && !crafting
                ? 'bg-gradient-to-r from-purple-500 to-orange-500 text-white hover:shadow-lg hover:shadow-purple-500/25'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {crafting ? '✨ Crafting...' : `🔨 Craft ${recipe.output}`}
          </button>
        </div>
      </div>

      {/* Available cards to sacrifice */}
      <h2 className="text-lg font-semibold text-gray-300 mb-3">
        Available {recipe.input} Cards
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {availableCards.map((card) => (
          <Card
            key={card.id}
            card={card}
            size="sm"
            selected={selectedCards.some((c) => c.id === card.id)}
            onClick={() => toggleCard(card)}
          />
        ))}
      </div>
    </div>
  );
}
