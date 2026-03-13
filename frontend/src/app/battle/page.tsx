'use client';

import { useState } from 'react';
import { ALL_CARDS, ELEMENT_ICONS, type CardData } from '@/config/wagmi';

type BattlePhase = 'lobby' | 'active' | 'result';
type MoveType = 'attack' | 'defend' | 'special';

const DEMO_HAND: CardData[] = [ALL_CARDS[6], ALL_CARDS[12], ALL_CARDS[3], ALL_CARDS[15], ALL_CARDS[9]];
const ENEMY_CARD = ALL_CARDS[11];

export default function BattlePage() {
  const [phase, setPhase] = useState<BattlePhase>('lobby');
  const [playerHP, setPlayerHP] = useState(100);
  const [enemyHP, setEnemyHP] = useState(100);
  const [energy, setEnergy] = useState(5);
  const [specialUsed, setSpecialUsed] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [turn, setTurn] = useState(1);

  const startBattle = () => {
    setPhase('active');
    setPlayerHP(100);
    setEnemyHP(100);
    setEnergy(5);
    setSpecialUsed(false);
    setSelectedCard(null);
    setLog(['⚔️ Battle started! Your turn.']);
    setTurn(1);
  };

  const makeMove = (move: MoveType) => {
    if (!selectedCard) return;
    const card = selectedCard;
    const cost = card.energyCost;
    if (energy < cost) return;

    let damage = 0;
    let logMsg = '';

    // Check element advantage
    const hasAdvantage = (
      (card.element === 'Fire' && ENEMY_CARD.element === 'Earth') ||
      (card.element === 'Earth' && ENEMY_CARD.element === 'Water') ||
      (card.element === 'Water' && ENEMY_CARD.element === 'Fire')
    );

    if (move === 'attack') {
      damage = Math.max(1, card.attack - ENEMY_CARD.defense);
      if (hasAdvantage) damage += 3;
      logMsg = `🗡️ ${card.name} attacks for ${damage} dmg${hasAdvantage ? ' (Super Effective! 🔥)' : ''}`;
    } else if (move === 'defend') {
      logMsg = `🛡️ ${card.name} takes a defensive stance`;
    } else if (move === 'special') {
      damage = Math.max(1, card.attack - ENEMY_CARD.defense) * 2;
      if (hasAdvantage) damage += 6;
      logMsg = `💥 ${card.name} uses SPECIAL for ${damage} dmg!`;
      setSpecialUsed(true);
    }

    const newEnemyHP = Math.max(0, enemyHP - damage);
    setEnemyHP(newEnemyHP);
    setEnergy(e => e - cost);

    // Enemy counter-attack
    const enemyDmg = Math.max(1, ENEMY_CARD.attack - card.defense);
    const newPlayerHP = Math.max(0, playerHP - enemyDmg);
    setPlayerHP(newPlayerHP);

    setLog(prev => [
      ...prev,
      `Turn ${turn}: ${logMsg}`,
      `  ↩️ ${ENEMY_CARD.name} counters for ${enemyDmg} dmg`,
    ]);

    setSelectedCard(null);
    setTurn(t => t + 1);

    // Refill energy (gain 3, cap at 5)
    setEnergy(e => Math.min(5, (e - cost) + 3));

    // Check win/lose
    if (newEnemyHP <= 0 || newPlayerHP <= 0) {
      setPhase('result');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-3xl font-bold mb-6">
        <span className="mr-2">⚔️</span> Battle Arena
      </h1>

      {/* ── Lobby ───────────────────────────────────────── */}
      {phase === 'lobby' && (
        <div className="text-center py-16">
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 max-w-md mx-auto">
            <div className="text-6xl mb-4">⚔️</div>
            <h2 className="text-2xl font-bold mb-2">Ready to Battle?</h2>
            <p className="text-gray-400 mb-6 text-sm">
              Challenge another player or fight the AI opponent. Use element advantages and manage your energy wisely!
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={startBattle}
                className="py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all cursor-pointer"
              >
                🤖 Battle AI (Demo)
              </button>
              <button className="py-3 bg-white/5 text-gray-300 font-medium rounded-xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer">
                👥 Challenge Player (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Battle ────────────────────────────────── */}
      {phase === 'active' && (
        <div className="space-y-4">
          {/* HP Bars */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-cyan-400 font-bold">You</span>
                <span className="text-white font-bold">{playerHP} HP</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    playerHP > 60 ? 'bg-green-500' : playerHP > 30 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${playerHP}%` }}
                />
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-red-400 font-bold">🤖 AI Opponent</span>
                <span className="text-white font-bold">{enemyHP} HP</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    enemyHP > 60 ? 'bg-green-500' : enemyHP > 30 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${enemyHP}%` }}
                />
              </div>
            </div>
          </div>

          {/* Energy Bar */}
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-sm font-bold">⚡ Energy:</span>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-3 rounded-full transition-all ${
                      i < energy ? 'bg-yellow-400 energy-active' : 'bg-gray-700'
                    }`}
                  />
                ))}
              </div>
              <span className="text-gray-400 text-xs ml-auto">Turn {turn}</span>
            </div>
          </div>

          {/* Enemy Card Display */}
          <div className="text-center py-4">
            <p className="text-gray-500 text-xs mb-2">Enemy&apos;s Active Card</p>
            <div className="inline-flex items-center gap-3 bg-red-500/10 rounded-xl px-6 py-3 border border-red-500/20">
              <span className="text-2xl">{ELEMENT_ICONS[ENEMY_CARD.element]}</span>
              <div className="text-left">
                <p className="text-white font-bold text-sm">{ENEMY_CARD.name}</p>
                <p className="text-gray-400 text-xs">⚔ {ENEMY_CARD.attack} | 🛡 {ENEMY_CARD.defense}</p>
              </div>
            </div>
          </div>

          {/* Hand */}
          <div>
            <p className="text-gray-400 text-sm mb-2">Your Hand — tap a card to select it</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {DEMO_HAND.map((card) => {
                const isSelected = selectedCard?.id === card.id;
                const canAfford = energy >= card.energyCost;
                return (
                  <button
                    key={card.id}
                    onClick={() => canAfford && setSelectedCard(isSelected ? null : card)}
                    disabled={!canAfford}
                    className={`flex-shrink-0 w-28 rounded-xl p-3 border transition-all ${
                      isSelected
                        ? 'bg-orange-500/20 border-orange-400 scale-105 shadow-lg shadow-orange-500/20'
                        : canAfford
                          ? 'bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer'
                          : 'bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="text-lg mb-1">{ELEMENT_ICONS[card.element]}</div>
                    <p className="text-white text-xs font-bold truncate">{card.name}</p>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>⚔{card.attack}</span>
                      <span>🛡{card.defense}</span>
                    </div>
                    <div className="text-yellow-400 text-[10px] font-bold mt-1">⚡{card.energyCost}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => makeMove('attack')}
              disabled={!selectedCard}
              className="py-3 bg-red-500/20 text-red-300 font-bold rounded-xl border border-red-500/20 hover:bg-red-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              🗡️ Attack
            </button>
            <button
              onClick={() => makeMove('defend')}
              disabled={!selectedCard}
              className="py-3 bg-blue-500/20 text-blue-300 font-bold rounded-xl border border-blue-500/20 hover:bg-blue-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              🛡️ Defend
            </button>
            <button
              onClick={() => makeMove('special')}
              disabled={!selectedCard || specialUsed}
              className={`py-3 font-bold rounded-xl border transition-all cursor-pointer ${
                specialUsed
                  ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed'
                  : 'bg-purple-500/20 text-purple-300 border-purple-500/20 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed'
              }`}
            >
              💥 Special {specialUsed ? '(Used)' : ''}
            </button>
          </div>

          {/* Battle Log */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/5 max-h-40 overflow-y-auto">
            <h3 className="text-sm font-bold text-gray-400 mb-2">Battle Log</h3>
            {log.map((msg, i) => (
              <p key={i} className="text-xs text-gray-400 py-0.5">{msg}</p>
            ))}
          </div>
        </div>
      )}

      {/* ── Result ───────────────────────────────────────── */}
      {phase === 'result' && (
        <div className="text-center py-16">
          <div className="victory-pop">
            <div className="text-7xl mb-4">{enemyHP <= 0 ? '🏆' : '💀'}</div>
            <h2 className="text-4xl font-black mb-2">
              {enemyHP <= 0 ? (
                <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                  VICTORY!
                </span>
              ) : (
                <span className="text-red-400">DEFEAT</span>
              )}
            </h2>
            <div className="flex justify-center gap-6 my-6 text-sm">
              <div className="bg-white/5 rounded-xl px-6 py-3">
                <div className="text-gray-500">Your HP</div>
                <div className="text-xl font-bold text-white">{playerHP}</div>
              </div>
              <div className="bg-white/5 rounded-xl px-6 py-3">
                <div className="text-gray-500">Enemy HP</div>
                <div className="text-xl font-bold text-white">{enemyHP}</div>
              </div>
              <div className="bg-white/5 rounded-xl px-6 py-3">
                <div className="text-gray-500">Turns</div>
                <div className="text-xl font-bold text-white">{turn - 1}</div>
              </div>
            </div>
            {enemyHP <= 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-6 py-3 inline-block mb-6">
                <span className="text-green-400 font-bold">+25 RP earned</span>
                {turn < 5 && <span className="text-yellow-400 ml-2">+10 Fast Win Bonus!</span>}
              </div>
            )}
            <div>
              <button
                onClick={() => setPhase('lobby')}
                className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold rounded-xl hover:shadow-lg transition-all cursor-pointer"
              >
                🔄 Battle Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
