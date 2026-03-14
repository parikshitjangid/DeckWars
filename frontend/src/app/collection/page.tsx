'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import Card from '@/components/Card';
import { ALL_CARDS, type CardRarity, type CardElement } from '@/config/wagmi';
import { useAllCardBalances, useContractsReady } from '@/hooks/useContracts';

const RARITY_TABS: ('All' | CardRarity)[] = ['All', 'Common', 'Rare', 'Epic', 'Legendary'];
const ELEMENT_TABS: ('All' | CardElement)[] = ['All', 'Fire', 'Water', 'Earth'];

export default function CollectionPage() {
  const [rarityFilter, setRarityFilter] = useState<'All' | CardRarity>('All');
  const [elementFilter, setElementFilter] = useState<'All' | CardElement>('All');
  const { address, isConnected } = useAccount();
  const contractsReady = useContractsReady();
  const balanceResults = useAllCardBalances();

  // Build owned map: either from chain or fallback to demo
  const ownedCards: Record<number, number> = {};
  ALL_CARDS.forEach((card, i) => {
    if (contractsReady && isConnected && balanceResults[i]?.data !== undefined) {
      ownedCards[card.id] = Number(balanceResults[i].data);
    } else {
      // Demo fallback when contracts not deployed
      ownedCards[card.id] = Math.floor(Math.random() * 5);
    }
  });

  const isLoading = contractsReady && isConnected && balanceResults.some((r) => r.isLoading);

  const filtered = ALL_CARDS.filter((card) => {
    if (rarityFilter !== 'All' && card.rarity !== rarityFilter) return false;
    if (elementFilter !== 'All' && card.element !== elementFilter) return false;
    return true;
  });

  const discovered = Object.values(ownedCards).filter((v) => v > 0).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="mr-2">🃏</span> Card Collection
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Discovered: <span className="text-orange-400 font-bold">{discovered}/20</span> cards
            {!contractsReady && (
              <span className="ml-2 text-yellow-500/70 text-xs">(demo mode — contracts not deployed)</span>
            )}
          </p>
        </div>
        {!isConnected && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2 text-yellow-400 text-sm">
            Connect wallet to see your real card balances
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-4 text-gray-400 text-sm animate-pulse">
          Loading card balances from chain...
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 overflow-x-auto">
          {RARITY_TABS.map((r) => (
            <button
              key={r}
              onClick={() => setRarityFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                rarityFilter === r
                  ? 'bg-orange-500/20 text-orange-300'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          {ELEMENT_TABS.map((e) => (
            <button
              key={e}
              onClick={() => setElementFilter(e)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                elementFilter === e
                  ? 'bg-orange-500/20 text-orange-300'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {e === 'Fire' ? '🔥' : e === 'Water' ? '💧' : e === 'Earth' ? '🪨' : ''} {e}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
        {filtered.map((card) => (
          <Card
            key={card.id}
            card={card}
            owned={ownedCards[card.id]}
            showOwned
            size="md"
            silhouette={ownedCards[card.id] === 0}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-3">🔍</p>
          <p>No cards match your filters</p>
        </div>
      )}
    </div>
  );
}
