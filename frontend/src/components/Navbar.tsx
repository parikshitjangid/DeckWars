'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const NAV_ITEMS = [
  { href: '/',           label: 'Home',       icon: '🏠' },
  { href: '/collection', label: 'Collection', icon: '🃏' },
  { href: '/packs',      label: 'Packs',      icon: '📦' },
  { href: '/deck',       label: 'Deck',       icon: '📋' },
  { href: '/battle',     label: 'Battle',     icon: '⚔️' },
  { href: '/crafting',   label: 'Crafting',   icon: '🔨' },
  { href: '/season',     label: 'Season',     icon: '🏆' },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <>
      {/* ── Desktop nav ─────────────────────────────────────── */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl">⚡</span>
            <span className="text-xl font-black bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent group-hover:from-orange-300 group-hover:to-amber-200 transition-all">
              DeckWars
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-orange-500/20 text-orange-300 shadow-lg shadow-orange-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="mr-1.5">{icon}</span>
                  {label}
                </Link>
              );
            })}
          </div>

          <ConnectButton
            chainStatus="icon"
            showBalance={false}
            accountStatus="address"
          />
        </div>
      </nav>

      {/* ── Mobile bottom nav ───────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 safe-bottom">
        <div className="flex items-center justify-around py-2 px-2">
          {NAV_ITEMS.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all ${
                  active
                    ? 'text-orange-400 scale-110'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="text-lg">{icon}</span>
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Mobile top bar ──────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10 px-4 py-2 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <span className="text-lg font-black bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
            DeckWars
          </span>
        </Link>
        <ConnectButton
          chainStatus="none"
          showBalance={false}
          accountStatus="avatar"
        />
      </div>
    </>
  );
}
