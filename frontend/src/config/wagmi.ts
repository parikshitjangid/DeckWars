'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain, getAddress } from 'viem';

/* ── HeLa L1 Testnet chain definition ────────────────────────── */
export const helaTestnet = defineChain({
  id: 666888,
  name: 'HeLa Testnet',
  nativeCurrency: { name: 'HELA', symbol: 'HELA', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.helachain.com'] },
  },
  blockExplorers: {
    default: { name: 'HeLa Explorer', url: 'https://testnet-blockexplorer.helachain.com' },
  },
  testnet: true,
});

/* ── wagmi + RainbowKit config ───────────────────────────────── */
export const config = getDefaultConfig({
  appName: 'DeckWars',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'deckwars-demo',
  chains: [helaTestnet],
  ssr: true,
});

/* ── Helper: Safe address checksum ───────────────────────────── */
const safeAddr = (addr: string | undefined) => {
  if (!addr || addr === '0x...' || addr === '') return '';
  try {
    return getAddress(addr);
  } catch (e) {
    console.warn(`⚠️ Invalid address in config: ${addr}`);
    return addr;
  }
};

/* ── Contract addresses (filled after deploy) ────────────────── */
export const CONTRACTS = {
  CardNFT:       safeAddr(process.env.NEXT_PUBLIC_CARD_NFT),
  DeckManager:   safeAddr(process.env.NEXT_PUBLIC_DECK_MANAGER),
  BattleEngine:  safeAddr(process.env.NEXT_PUBLIC_BATTLE_ENGINE),
  AIBattleAgent: safeAddr(process.env.NEXT_PUBLIC_AI_AGENT_ADDRESS),
  QuestSystem:   safeAddr(process.env.NEXT_PUBLIC_QUEST_SYSTEM),
  RankSystem:    safeAddr(process.env.NEXT_PUBLIC_RANK_SYSTEM),
  SeasonEngine:  safeAddr(process.env.NEXT_PUBLIC_SEASON_ENGINE),
  SeasonRewards: safeAddr(process.env.NEXT_PUBLIC_SEASON_REWARDS),
  CraftingSystem:safeAddr(process.env.NEXT_PUBLIC_CRAFTING),
  PremiumPacks:  safeAddr(process.env.NEXT_PUBLIC_PREMIUM_PACKS),
  SeasonPass:    safeAddr(process.env.NEXT_PUBLIC_SEASON_PASS),
  TreasuryVault: safeAddr(process.env.NEXT_PUBLIC_TREASURY),
  HLUSD:         safeAddr(process.env.NEXT_PUBLIC_HLUSD),
} as const;

/* ── Card data (mirrors deploy/01_economy.ts card configs) ──── */
export type CardElement = 'Fire' | 'Water' | 'Earth';
export type CardRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export interface CardData {
  id: number;
  name: string;
  attack: number;
  defense: number;
  element: CardElement;
  rarity: CardRarity;
  energyCost: number;
}

const ELEMENTS: CardElement[] = ['Fire', 'Water', 'Earth'];
const RARITIES: CardRarity[] = ['Common', 'Rare', 'Epic', 'Legendary'];

export const ALL_CARDS: CardData[] = [
  { id: 1,  name: 'Ember Scout',     attack: 3, defense: 2, element: 'Fire',  rarity: 'Common',    energyCost: 1 },
  { id: 2,  name: 'Aqua Shield',     attack: 2, defense: 4, element: 'Water', rarity: 'Common',    energyCost: 1 },
  { id: 3,  name: 'Stone Golem',     attack: 4, defense: 1, element: 'Earth', rarity: 'Common',    energyCost: 1 },
  { id: 4,  name: 'Flame Wisp',      attack: 3, defense: 3, element: 'Fire',  rarity: 'Common',    energyCost: 1 },
  { id: 5,  name: 'Tidal Sprite',    attack: 2, defense: 3, element: 'Water', rarity: 'Common',    energyCost: 1 },
  { id: 6,  name: 'Quake Knight',    attack: 5, defense: 4, element: 'Earth', rarity: 'Rare',      energyCost: 2 },
  { id: 7,  name: 'Blaze Warrior',   attack: 6, defense: 5, element: 'Fire',  rarity: 'Rare',      energyCost: 2 },
  { id: 8,  name: 'Frost Mage',      attack: 4, defense: 7, element: 'Water', rarity: 'Rare',      energyCost: 2 },
  { id: 9,  name: 'Terra Guardian',  attack: 5, defense: 6, element: 'Earth', rarity: 'Rare',      energyCost: 2 },
  { id: 10, name: 'Pyro Captain',    attack: 6, defense: 4, element: 'Fire',  rarity: 'Rare',      energyCost: 2 },
  { id: 11, name: 'Tsunami Lord',    attack: 7, defense: 6, element: 'Water', rarity: 'Epic',      energyCost: 3 },
  { id: 12, name: 'Mountain Titan',  attack: 8, defense: 7, element: 'Earth', rarity: 'Epic',      energyCost: 3 },
  { id: 13, name: 'Inferno Dragon',  attack: 9, defense: 6, element: 'Fire',  rarity: 'Epic',      energyCost: 3 },
  { id: 14, name: 'Abyssal Leviathan', attack: 7, defense: 8, element: 'Water', rarity: 'Epic',    energyCost: 3 },
  { id: 15, name: 'Crystal Behemoth', attack: 8, defense: 7, element: 'Earth', rarity: 'Epic',     energyCost: 3 },
  { id: 16, name: 'Phoenix King',    attack: 9, defense: 8, element: 'Fire',  rarity: 'Legendary', energyCost: 4 },
  { id: 17, name: 'Poseidon\'s Wrath', attack: 10, defense: 9, element: 'Water', rarity: 'Legendary', energyCost: 4 },
  { id: 18, name: 'Gaia Empress',    attack: 9, defense: 10, element: 'Earth', rarity: 'Legendary', energyCost: 4 },
  { id: 19, name: 'Solar Overlord',  attack: 10, defense: 8, element: 'Fire',  rarity: 'Legendary', energyCost: 4 },
  { id: 20, name: 'Eternal Hydra',   attack: 10, defense: 10, element: 'Water', rarity: 'Legendary', energyCost: 4 },
];

export const RARITY_COLORS: Record<CardRarity, string> = {
  Common:    'from-slate-400 to-slate-500',
  Rare:      'from-blue-400 to-blue-600',
  Epic:      'from-purple-400 to-purple-600',
  Legendary: 'from-amber-400 to-orange-500',
};

export const ELEMENT_COLORS: Record<CardElement, string> = {
  Fire:  'text-red-400',
  Water: 'text-cyan-400',
  Earth: 'text-green-400',
};

export const ELEMENT_ICONS: Record<CardElement, string> = {
  Fire:  '🔥',
  Water: '💧',
  Earth: '🪨',
};
