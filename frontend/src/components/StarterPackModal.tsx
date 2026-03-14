'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import CardNFTAbi from '@/abis/CardNFT.json';
import { CONTRACTS } from '@/config/wagmi';
import { Address } from 'viem';

export default function StarterPackModal() {
  const { address, isConnected } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [drop, setDrop] = useState<Record<number, number> | null>(null);

  // Check if user has zero cards
  const { data: balanceData, refetch } = useReadContract({
    address: CONTRACTS.CardNFT as Address,
    abi: CardNFTAbi,
    functionName: 'balanceOfBatch',
    args: [
      Array(20).fill(address),
      Array.from({ length: 20 }, (_, i) => BigInt(i + 1))
    ],
    query: {
        enabled: isConnected && !!address,
        staleTime: 60000,
    }
  });

  useEffect(() => {
    if (isConnected && balanceData) {
      const balances = balanceData as bigint[];
      const totalCards = balances.reduce((acc, val) => acc + val, BigInt(0));
      
      if (totalCards === BigInt(0) && !success) {
        setIsOpen(true);
      }
    }
  }, [isConnected, balanceData, success]);

  const claimStarterPack = async () => {
    setIsMinting(true);
    setError(null);
    try {
      const res = await fetch('/api/starter-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerAddress: address })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mint starter pack');
      
      setDrop(data.drop);
      setSuccess(true);
      refetch(); // Update UI balances
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsMinting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-gray-900 border border-amber-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-[0_0_40px_-10px_rgba(245,158,11,0.3)]">
        {!success ? (
          <>
            <div className="text-6xl mb-4">🎁</div>
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Welcome to DeckWars!</h2>
            <p className="text-gray-400 mb-8 mx-auto leading-relaxed text-sm">
              It looks like you don't have any cards yet. Claim your <strong className="text-amber-400 font-bold">Free Starter Pack</strong> of 20 random cards to build your first deck and start battling!
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl mb-6 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={claimStarterPack}
              disabled={isMinting}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-lg rounded-xl hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              {isMinting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating Drop...
                </span>
              ) : (
                'Claim 20 Cards (Zero Gas)'
              )}
            </button>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4 animate-bounce">⚔️</div>
            <h2 className="text-3xl font-black text-emerald-400 mb-2">Cards Minted!</h2>
            <p className="text-gray-300 mb-8 text-sm">
              Your 20 starter cards have been securely airdropped to your wallet. You're ready to build your deck!
            </p>
            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
            >
              Go to Deck Builder
            </button>
          </>
        )}
      </div>
    </div>
  );
}
