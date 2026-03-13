'use client';

import { type CardData, RARITY_COLORS, ELEMENT_ICONS, ELEMENT_COLORS } from '@/config/wagmi';

interface CardComponentProps {
  card: CardData;
  owned?: number;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showOwned?: boolean;
  silhouette?: boolean;
}

export default function Card({
  card,
  owned = 0,
  selected = false,
  onClick,
  size = 'md',
  showOwned = false,
  silhouette = false,
}: CardComponentProps) {
  const sizeClasses = {
    sm: 'w-28 h-40',
    md: 'w-36 h-52',
    lg: 'w-48 h-68',
  };

  const rarityGrad = RARITY_COLORS[card.rarity];

  if (silhouette) {
    return (
      <div className={`${sizeClasses[size]} rounded-xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center`}>
        <span className="text-4xl opacity-20">❓</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`${sizeClasses[size]} relative rounded-xl overflow-hidden transition-all duration-300 group cursor-pointer
        ${selected
          ? 'ring-2 ring-orange-400 shadow-lg shadow-orange-500/30 scale-105'
          : 'hover:scale-105 hover:shadow-lg hover:shadow-white/10'
        }
        ${owned === 0 && showOwned ? 'opacity-40 grayscale' : ''}
      `}
    >
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${rarityGrad} opacity-90`} />

      {/* Glass overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Content */}
      <div className="relative h-full flex flex-col justify-between p-2.5">
        {/* Top: Element + Energy */}
        <div className="flex items-center justify-between">
          <span className={`text-sm ${ELEMENT_COLORS[card.element]}`}>
            {ELEMENT_ICONS[card.element]}
          </span>
          <span className="bg-yellow-500/20 text-yellow-300 text-xs font-bold px-1.5 py-0.5 rounded-full">
            ⚡{card.energyCost}
          </span>
        </div>

        {/* Center: Icon placeholder */}
        <div className="flex-1 flex items-center justify-center">
          <span className="text-3xl group-hover:scale-110 transition-transform">
            {ELEMENT_ICONS[card.element]}
          </span>
        </div>

        {/* Bottom: Name + Stats */}
        <div className="space-y-1">
          <p className="text-white font-bold text-xs leading-tight truncate">{card.name}</p>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-red-300">⚔ {card.attack}</span>
            <span className="text-blue-300">🛡 {card.defense}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-[9px] font-semibold uppercase tracking-wider ${
              card.rarity === 'Legendary' ? 'text-amber-300' :
              card.rarity === 'Epic' ? 'text-purple-300' :
              card.rarity === 'Rare' ? 'text-blue-300' : 'text-gray-300'
            }`}>
              {card.rarity}
            </span>
            {showOwned && (
              <span className="text-[9px] text-gray-400">×{owned}</span>
            )}
          </div>
        </div>
      </div>

      {/* Selected checkmark */}
      {selected && (
        <div className="absolute top-1 right-1 bg-orange-500 rounded-full w-5 h-5 flex items-center justify-center text-xs">
          ✓
        </div>
      )}
    </button>
  );
}
