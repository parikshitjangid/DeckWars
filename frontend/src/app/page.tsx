'use client';

import Link from 'next/link';
import Card from '@/components/Card';
import { ALL_CARDS } from '@/config/wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const FEATURED_CARDS = [ALL_CARDS[15], ALL_CARDS[16], ALL_CARDS[17]]; // Legendaries

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="py-12 md:py-20 text-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-purple-500/10 to-cyan-500/10 blur-3xl" />
          <h1 className="relative text-5xl md:text-7xl font-black mb-4">
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
              DeckWars
            </span>
          </h1>
          <p className="relative text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-2">
            Fully on-chain Trading Card Game on{' '}
            <span className="text-cyan-400 font-semibold">HeLa L1</span>
          </p>
          <p className="relative text-gray-500 text-sm max-w-lg mx-auto mb-8">
            Collect elemental cards • Build powerful decks • Battle PvP & AI •
            Craft rare NFTs • Climb the leaderboard
          </p>
          <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4">
            <ConnectButton />
            <Link
              href="/battle"
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-105"
            >
              ⚔️ Enter the Arena
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats Strip ──────────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-16">
        {[
          { label: 'Card Types', value: '20', icon: '🃏' },
          { label: 'Elements', value: '3', icon: '🔥💧🪨' },
          { label: 'Season', value: '#1', icon: '🏆' },
          { label: 'Chain', value: 'HeLa L1', icon: '⛓️' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/5 text-center hover:bg-white/10 transition-colors">
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </section>

      {/* ── Featured Legendaries ──────────────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 text-center">
          <span className="text-amber-400">✨</span> Legendary Cards
        </h2>
        <div className="flex justify-center gap-4 flex-wrap">
          {FEATURED_CARDS.map((card) => (
            <div key={card.id} className="legendary-glow rounded-xl">
              <Card card={card} size="lg" />
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-8 text-center text-gray-200">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Collect Cards', desc: 'Open packs or craft cards. Each card is an ERC-1155 NFT with unique stats and element.', icon: '📦' },
            { step: '2', title: 'Build Your Deck', desc: 'Choose 20 cards. Balance your elements for type advantages. manage energy costs wisely.', icon: '📋' },
            { step: '3', title: 'Battle & Climb', desc: 'Challenge players or fight AI. Win to earn RP, climb ranks, and claim season rewards.', icon: '⚔️' },
          ].map(({ step, title, desc, icon }) => (
            <div key={step} className="bg-white/5 rounded-xl p-6 border border-white/5 hover:border-orange-500/30 transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl group-hover:scale-110 transition-transform">{icon}</span>
                <div>
                  <span className="text-orange-400 text-xs font-bold">STEP {step}</span>
                  <h3 className="text-lg font-bold text-white">{title}</h3>
                </div>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Element Triangle ─────────────────────────────── */}
      <section className="mb-16 text-center">
        <h2 className="text-2xl font-bold mb-6 text-gray-200">Element Triangle</h2>
        <div className="inline-flex items-center gap-4 bg-white/5 rounded-2xl p-6 border border-white/5">
          <div className="text-center">
            <div className="text-4xl mb-1">🔥</div>
            <div className="text-sm font-bold text-red-400">Fire</div>
          </div>
          <div className="text-gray-500 text-xl">→</div>
          <div className="text-center">
            <div className="text-4xl mb-1">🪨</div>
            <div className="text-sm font-bold text-green-400">Earth</div>
          </div>
          <div className="text-gray-500 text-xl">→</div>
          <div className="text-center">
            <div className="text-4xl mb-1">💧</div>
            <div className="text-sm font-bold text-cyan-400">Water</div>
          </div>
          <div className="text-gray-500 text-xl">→</div>
          <div className="text-center">
            <div className="text-4xl mb-1">🔥</div>
            <div className="text-sm font-bold text-red-400">Fire</div>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          <span className="text-green-400 font-semibold">+3 bonus damage</span>{' '}
          when attacking with type advantage!
        </p>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 text-center text-gray-600 text-sm">
        <p>
          Built on{' '}
          <a href="https://helachain.com" className="text-cyan-500 hover:text-cyan-400 transition-colors" target="_blank" rel="noopener">
            HeLa L1
          </a>{' '}
          • Powered by HLUSD •{' '}
          <a href="https://helalabs.com" className="text-cyan-500 hover:text-cyan-400 transition-colors" target="_blank" rel="noopener">
            helalabs.com
          </a>
        </p>
      </footer>
    </div>
  );
}
