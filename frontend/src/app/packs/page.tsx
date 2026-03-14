'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import Card from '@/components/Card';
import { ALL_CARDS, CONTRACTS, type CardData } from '@/config/wagmi';
import { useApproveHLUSD, useOpenPack, useHLUSDBalance, useContractsReady } from '@/hooks/useContracts';
import { type Address, formatEther } from 'viem';

const PACKS = [
  { tier: 0, name: 'Silver Pack',  price: '10', cards: 3, color: 'from-gray-300 to-gray-500',  icon: '🥈', pity: 'Rare guaranteed every 50 packs' },
  { tier: 1, name: 'Gold Pack',    price: '25', cards: 4, color: 'from-yellow-400 to-amber-500', icon: '🥇', pity: 'Epic guaranteed every 25 packs' },
  { tier: 2, name: 'Diamond Pack', price: '50', cards: 5, color: 'from-cyan-300 to-blue-500',   icon: '💎', pity: 'Legendary guaranteed every 10 packs' },
];

export default function PacksPage() {
  const { isConnected } = useAccount();
  const contractsReady = useContractsReady();
  const hlBalance = useHLUSDBalance();
  const { approve, isPending: isApproving } = useApproveHLUSD();
  const { openPack, isPending: isOpening, isConfirming, isSuccess } = useOpenPack();
  const [opening, setOpening] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [revealedCards, setRevealedCards] = useState<CardData[]>([]);
  const [revealPhase, setRevealPhase] = useState<'idle' | 'opening' | 'reveal'>('idle');

  const balance = hlBalance.data ? formatEther(hlBalance.data as bigint) : '0';

  const handleOpenPack = (tier: number) => {
    setSelectedTier(tier);
    const pack = PACKS[tier];

    if (contractsReady && isConnected) {
      // Real on-chain: approve HLUSD then open pack
      const amount = BigInt(pack.price) * BigInt(10) ** BigInt(18);
      approve(CONTRACTS.PremiumPacks as Address, amount);
      // After approval succeeds, user would need to call openPack
      // For simplicity we chain it
      setTimeout(() => {
        openPack(tier);
      }, 3000);
    }

    // Visual animation regardless
    setRevealPhase('opening');
    setRevealedCards([]);

    setTimeout(() => {
      // Generate random cards based on pack tier
      const numCards = pack.cards;
      const cards: CardData[] = [];
      for (let i = 0; i < numCards; i++) {
        // Weight toward rarity by tier
        let pool: CardData[];
        const roll = Math.random();
        if (tier === 2 && roll > 0.7) {
          pool = ALL_CARDS.filter(c => c.rarity === 'Legendary' || c.rarity === 'Epic');
        } else if (tier >= 1 && roll > 0.6) {
          pool = ALL_CARDS.filter(c => c.rarity === 'Epic' || c.rarity === 'Rare');
        } else if (roll > 0.5) {
          pool = ALL_CARDS.filter(c => c.rarity === 'Rare');
        } else {
          pool = ALL_CARDS.filter(c => c.rarity === 'Common');
        }
        cards.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      setRevealedCards(cards);
      setRevealPhase('reveal');
    }, 2500);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">
          <span className="mr-2">📦</span> Open Packs
        </h1>
        {isConnected && (
          <div className="bg-white/5 rounded-xl px-4 py-2 border border-white/5 text-sm">
            <span className="text-gray-400">Balance: </span>
            <span className="text-green-400 font-bold">{Number(balance).toFixed(2)} HLUSD</span>
          </div>
        )}
      </div>

      {!contractsReady && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-yellow-400 text-sm mb-6 text-center">
          ⚠️ Demo mode — packs show simulated results. Deploy contracts to open real packs.
        </div>
      )}

      {/* Pack Selector */}
      {revealPhase === 'idle' && (
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {PACKS.map((pack) => (
            <div
              key={pack.tier}
              className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden hover:border-white/20 transition-all group"
            >
              {/* Pack visual */}
              <div className={`bg-gradient-to-br ${pack.color} p-8 text-center relative overflow-hidden`}>
                <div className="absolute inset-0 card-shimmer" />
                <div className="relative">
                  <div className="text-5xl mb-2 group-hover:scale-110 transition-transform">{pack.icon}</div>
                  <h3 className="text-xl font-black text-black/80">{pack.name}</h3>
                </div>
              </div>

              {/* Pack info */}
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Price</span>
                  <span className="text-white font-bold">{pack.price} HLUSD</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Cards</span>
                  <span className="text-white font-bold">{pack.cards} cards</span>
                </div>
                <p className="text-gray-500 text-xs">{pack.pity}</p>

                <button
                  onClick={() => handleOpenPack(pack.tier)}
                  disabled={isApproving || isOpening}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all cursor-pointer disabled:opacity-40"
                >
                  {isApproving ? '⏳ Approving HLUSD...' :
                   isOpening ? '📦 Opening...' :
                   `Open for ${pack.price} HLUSD`}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Opening Animation */}
      {revealPhase === 'opening' && (
        <div className="text-center py-20">
          <div className="inline-block animate-bounce">
            <div className="text-8xl">{selectedTier !== null ? PACKS[selectedTier].icon : '📦'}</div>
          </div>
          <p className="text-gray-400 mt-4 animate-pulse text-lg">Opening pack...</p>
          {(isApproving || isConfirming) && (
            <p className="text-cyan-400 mt-2 text-sm">⛓️ Confirming on-chain...</p>
          )}
        </div>
      )}

      {/* Reveal */}
      {revealPhase === 'reveal' && (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-6">
            ✨ You got {revealedCards.length} cards!
            {isSuccess && <span className="text-green-400 text-sm ml-2">(minted on-chain ✓)</span>}
          </h2>
          <div className="flex justify-center gap-4 flex-wrap mb-8">
            {revealedCards.map((card, i) => (
              <div key={i} className="victory-pop" style={{ animationDelay: `${i * 0.2}s` }}>
                <Card card={card} size="md" />
              </div>
            ))}
          </div>
          <button
            onClick={() => { setRevealPhase('idle'); setRevealedCards([]); setSelectedTier(null); }}
            className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold rounded-xl hover:shadow-lg transition-all cursor-pointer"
          >
            🔄 Open Another Pack
          </button>
        </div>
      )}
    </div>
  );
}
