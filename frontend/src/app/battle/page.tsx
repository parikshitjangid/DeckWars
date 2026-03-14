'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { type Address } from 'viem';
import { ALL_CARDS, ELEMENT_ICONS, type CardData } from '@/config/wagmi';
import {
  useChallengePlayer, useAcceptBattle, useMakeMove, useClaimTimeout,
  useBattleState, usePlayerHand, useActiveBattle, useContractsReady,
  useApproveHLUSD, useHLUSDAllowance, useChallengeAI, useAIRewardPoolBalance
} from '@/hooks/useContracts';
import { CONTRACTS } from '@/config/wagmi';
import { parseUnits, formatEther, formatUnits } from 'viem';

type BattlePhase = 'lobby' | 'matchmaking' | 'active' | 'result';
type MoveType = 'attack' | 'defend' | 'special';

const DEMO_HAND: CardData[] = [ALL_CARDS[6], ALL_CARDS[12], ALL_CARDS[3], ALL_CARDS[15], ALL_CARDS[9]];
const ENEMY_CARD = ALL_CARDS[11];

function BattlePageContent() {
  const { address, isConnected } = useAccount();
  const searchParams = useSearchParams();
  const initialOpponent = searchParams.get('opponent') || '';
  const contractsReady = useContractsReady();

  // On-chain hooks
  const { challenge, isPending: isChallengePending } = useChallengePlayer();
  const { accept, isPending: isAcceptPending } = useAcceptBattle();
  const { makeMove: makeMoveOnChain, isPending: isMovePending } = useMakeMove();
  const activeBattle = useActiveBattle();
  const activeBattleId = activeBattle.data ? BigInt(String(activeBattle.data)) : BigInt(0);
  const battleState = useBattleState(activeBattleId);
  const playerHand = usePlayerHand(activeBattleId);

  // Local demo state
  const [phase, setPhase] = useState<BattlePhase>('lobby');
  const [playerHP, setPlayerHP] = useState(100);
  const [enemyHP, setEnemyHP] = useState(100);
  const [energy, setEnergy] = useState(5);
  const [specialUsed, setSpecialUsed] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [turn, setTurn] = useState(1);
  const [opponentAddress, setOpponentAddress] = useState(initialOpponent);
  const [wagerInput, setWagerInput] = useState('0');
  const [aiWagerInput, setAiWagerInput] = useState('0');
  const [isOnChain, setIsOnChain] = useState(false);

  // Wager approvals
  const { approve: approveHLUSD, isPending: isApprovePending } = useApproveHLUSD();
  
  // PvP Wager Allowance
  const hlusdAllowance = useHLUSDAllowance(CONTRACTS.BattleEngine as Address);
  const allowanceValue = hlusdAllowance.data ? (hlusdAllowance.data as bigint) : BigInt(0);

  // AI Wager Allowance
  const aiHlusdAllowance = useHLUSDAllowance(CONTRACTS.AIBattleAgent as Address);
  const aiAllowanceValue = aiHlusdAllowance.data ? (aiHlusdAllowance.data as bigint) : BigInt(0);

  // AI Rewards
  const { data: aiRewardPool } = useAIRewardPoolBalance();
  const { challengeAI, isPending: isAiChallengePending } = useChallengeAI();

  // Check for active on-chain battle
  useEffect(() => {
    if (activeBattleId > BigInt(0) && battleState.data) {
      setIsOnChain(true);
      const data = battleState.data as any[];
      const status = Number(data[3]); // BattleStatus index is 3
      if (status === 0) setPhase('matchmaking'); // Pending
      else if (status === 1) setPhase('active'); // Active
      else if (status === 2) setPhase('result'); // Completed
    }
  }, [activeBattleId, battleState.data]);

  const startDemoBattle = () => {
    // If wager is set, do the real on-chain AI battle
    if (parseUnits(aiWagerInput || '0', 18) > BigInt(0) || contractsReady) {
      if (!contractsReady) return;
      const wagerWei = parseUnits(aiWagerInput || '0', 18);
      // deckId 0, difficulty 1 (Medium), wagerAmount
      challengeAI(BigInt(0), 1, wagerWei);
      setPhase('matchmaking');
      setLog(['📡 AI Challenge sent on-chain. Generating agent move...']);
      return;
    }

    setIsOnChain(false);
    setPhase('active');
    setPlayerHP(100);
    setEnemyHP(100);
    setEnergy(5);
    setSpecialUsed(false);
    setSelectedCard(null);
    setLog(['⚔️ Battle started! Your turn.']);
    setTurn(1);
  };

  const startOnChainBattle = () => {
    if (!contractsReady || !opponentAddress) return;
    setIsOnChain(true);
    const wagerWei = parseUnits(wagerInput || '0', 18);
    challenge(opponentAddress as Address, BigInt(0), wagerWei);
    setPhase('matchmaking');
    setLog(['📡 Challenge sent on-chain. Waiting for opponent to accept...']);
  };

  const makeLocalMove = (move: MoveType) => {
    if (!selectedCard) return;
    const card = selectedCard;
    const cost = card.energyCost;
    if (energy < cost) return;

    let damage = 0;
    let logMsg = '';

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
    setEnergy(e => Math.min(5, (e - cost) + 3));

    if (newEnemyHP <= 0 || newPlayerHP <= 0) setPhase('result');
  };

  const handleMove = (move: MoveType) => {
    if (isOnChain && contractsReady && selectedCard) {
      const handIndex = DEMO_HAND.findIndex(c => c.id === selectedCard.id);
      const moveType = move === 'attack' ? 0 : move === 'defend' ? 1 : 2;
      makeMoveOnChain(activeBattleId, BigInt(handIndex), moveType);
    } else {
      makeLocalMove(move);
    }
  };

  // On-chain battle data parsing
  const onChainBattle = battleState.data ? (battleState.data as any[]) : null;
  const onChainHP = onChainBattle ? {
    playerA: Number(onChainBattle[1][2]),
    playerB: Number(onChainBattle[2][2]),
    status: Number(onChainBattle[3]),
    currentTurn: onChainBattle[4] as string,
    turnNumber: Number(onChainBattle[5]),
    winner: onChainBattle[9] as string,
    wagerAmount: BigInt(onChainBattle[10] || 0),
    playerA_Address: onChainBattle[1][0] as string,
    playerB_Address: onChainBattle[2][0] as string,
    playerADeposited: Boolean(onChainBattle[11]),
    playerBDeposited: Boolean(onChainBattle[12]),
  } : null;

  const isMyTurn = onChainHP?.currentTurn?.toLowerCase() === address?.toLowerCase();

  // Display values: on-chain or local
  const displayPlayerHP = isOnChain && onChainHP ? Math.max(0, onChainHP.playerA) : playerHP;
  const displayEnemyHP = isOnChain && onChainHP ? Math.max(0, onChainHP.playerB) : enemyHP;
  const displayTurn = isOnChain && onChainHP ? onChainHP.turnNumber : turn;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-3xl font-bold mb-6">
        <span className="mr-2">⚔️</span> Battle Arena
        {isOnChain && <span className="ml-2 text-xs text-green-400 font-normal">🟢 On-Chain</span>}
      </h1>

      {/* ── Lobby ───────────────────────────────────────── */}
      {phase === 'lobby' && (
        <div className="text-center py-8">
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 max-w-lg mx-auto">
            <div className="text-6xl mb-4">⚔️</div>
            <h2 className="text-2xl font-bold mb-2">Ready to Battle?</h2>
            <p className="text-gray-400 mb-6 text-sm">
              Challenge another player on-chain or try the local demo battle.
            </p>

            {/* On-chain PvP */}
            {contractsReady && isConnected && (
              <div className="mb-4">
                <label className="text-gray-400 text-xs mb-1 block text-left">Opponent wallet address</label>
                <input
                  value={opponentAddress}
                  onChange={(e) => setOpponentAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm mb-3 outline-none focus:border-orange-400"
                />
                
                <label className="text-gray-400 text-xs mb-1 block text-left">Wager (HLUSD)</label>
                <input
                  type="number"
                  min="0"
                  value={wagerInput}
                  onChange={(e) => setWagerInput(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm mb-3 outline-none focus:border-orange-400"
                />

                {parseUnits(wagerInput || '0', 18) > BigInt(0) && allowanceValue < parseUnits(wagerInput || '0', 18) ? (
                  <button
                    onClick={() => approveHLUSD(CONTRACTS.BattleEngine as Address, parseUnits(wagerInput, 18))}
                    disabled={isApprovePending}
                    className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl hover:shadow-lg transition-all cursor-pointer disabled:opacity-40"
                  >
                    {isApprovePending ? '⏳ Approving...' : '1. Approve Wager'}
                  </button>
                ) : (
                  <button
                    onClick={startOnChainBattle}
                    disabled={!opponentAddress || isChallengePending}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-black font-bold rounded-xl hover:shadow-lg hover:shadow-green-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isChallengePending ? '⏳ Sending challenge...' : (parseUnits(wagerInput || '0', 18) > BigInt(0) ? '2. Challenge Player (Wager)' : '⛓️ Challenge Player (Free)')}
                  </button>
                )}
                
                {isConnected && (
                  <button
                    onClick={() => {
                        const url = `${window.location.origin}/battle?opponent=${address}`;
                        navigator.clipboard.writeText(url);
                        alert('Invite link copied! Send this to the other device.');
                    }}
                    className="mt-3 w-full py-2 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl hover:bg-white/10 transition-all cursor-pointer text-sm"
                  >
                    🔗 Copy My Invite Link
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {contractsReady && isConnected && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-2">
                  <h3 className="text-sm font-bold text-gray-300 mb-2">🤖 Play vs AI</h3>
                  <label className="text-gray-400 text-xs mb-1 block text-left">Wager (HLUSD)</label>
                  <input
                    type="number"
                    min="0"
                    value={aiWagerInput}
                    onChange={(e) => setAiWagerInput(e.target.value)}
                    placeholder="0"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white text-sm mb-3 outline-none focus:border-amber-400"
                  />
                  {aiRewardPool !== undefined && (
                    <p className="text-xs text-amber-500 mb-3 text-right">
                      Max Payout Pool: {formatEther(aiRewardPool as bigint)} HLUSD
                    </p>
                  )}
                  {parseUnits(aiWagerInput || '0', 18) > BigInt(0) && aiAllowanceValue < parseUnits(aiWagerInput || '0', 18) ? (
                    <button
                      onClick={() => approveHLUSD(CONTRACTS.AIBattleAgent as Address, parseUnits(aiWagerInput, 18))}
                      disabled={isApprovePending}
                      className="w-full py-2 bg-blue-500 text-white font-bold rounded-xl hover:shadow-lg transition-all cursor-pointer disabled:opacity-40 text-sm"
                    >
                      {isApprovePending ? '⏳ Approving...' : '1. Approve AI Wager'}
                    </button>
                  ) : (
                    <button
                      onClick={startDemoBattle}
                      disabled={isAiChallengePending}
                      className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all cursor-pointer"
                    >
                      {isAiChallengePending ? '⏳ Challenging AI...' : (parseUnits(aiWagerInput || '0', 18) > BigInt(0) ? '2. Battle AI (Wager)' : '🤖 Battle AI (Free)')}
                    </button>
                  )}
                </div>
              )}
              
              {(!contractsReady || !isConnected) && (
                <button
                  onClick={startDemoBattle}
                  className="py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/25 transition-all cursor-pointer"
                >
                  🤖 Battle AI (Offline Demo)
                </button>
              )}
              
              {!isConnected && (
                <p className="text-gray-500 text-xs">
                  Connect your wallet for on-chain PvP battles

                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Matchmaking (waiting for accept/pending) ─────────────── */}
      {phase === 'matchmaking' && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4 animate-pulse">📡</div>
          <h2 className="text-2xl font-bold mb-2">
            {onChainHP && onChainHP.playerB_Address.toLowerCase() === address?.toLowerCase() ? 'Incoming Challenge!' : 'Waiting for Opponent...'}
          </h2>
          
          <div className="text-gray-400 text-sm mb-6 max-w-sm mx-auto bg-white/5 p-4 rounded-xl border border-white/10">
            {onChainHP && onChainHP.playerB_Address.toLowerCase() === address?.toLowerCase() ? (
              <>
                <p><strong>Challenger:</strong> {onChainHP.playerA_Address.slice(0, 6)}...{onChainHP.playerA_Address.slice(-4)}</p>
                <p className="text-orange-400 font-bold mt-2">Wager: {formatUnits(onChainHP.wagerAmount, 18)} HLUSD</p>
              </>
            ) : (
              <>
                <p>Challenge sent to {opponentAddress.slice(0, 6)}...{opponentAddress.slice(-4)}.</p>
                <p className="text-orange-400 font-bold mt-2">Wager: {wagerInput} HLUSD</p>
                <p className="text-xs mt-2 text-gray-500">They need to call acceptBattle() on-chain.</p>
              </>
            )}
          </div>

          {onChainHP && onChainHP.playerB_Address.toLowerCase() === address?.toLowerCase() ? (
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              {onChainHP.wagerAmount > BigInt(0) && allowanceValue < onChainHP.wagerAmount ? (
                <button
                  onClick={() => approveHLUSD(CONTRACTS.BattleEngine as Address, onChainHP.wagerAmount)}
                  disabled={isApprovePending}
                  className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl hover:shadow-lg transition-all cursor-pointer disabled:opacity-40"
                >
                  {isApprovePending ? '⏳ Approving...' : '1. Approve Wager'}
                </button>
              ) : (
                <button
                  onClick={() => accept(activeBattleId, BigInt(0), onChainHP.wagerAmount)}
                  disabled={isAcceptPending}
                  className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-black font-bold rounded-xl hover:shadow-lg transition-all cursor-pointer disabled:opacity-40"
                >
                  {isAcceptPending ? '⏳ Accepting...' : '⚔️ Accept Battle'}
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => { setPhase('lobby'); setIsOnChain(false); }}
              className="px-6 py-2 mt-4 bg-white/10 text-gray-300 rounded-xl hover:bg-white/15 transition-all cursor-pointer"
            >
              Cancel (Local only)
            </button>
          )}
        </div>
      )}

      {/* ── Active Battle ────────────────────────────────── */}
      {phase === 'active' && (
        <div className="space-y-4">
          {/* On-chain indicator */}
          {isOnChain && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center text-sm">
              <span className="text-green-400 font-bold">⛓️ On-Chain Battle</span>
              {isMyTurn ? (
                <span className="text-white ml-2">— Your turn!</span>
              ) : (
                <span className="text-gray-400 ml-2">— Waiting for opponent&apos;s move...</span>
              )}
            </div>
          )}

          {/* HP Bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-cyan-400 font-bold">You</span>
                <span className="text-white font-bold">{displayPlayerHP} HP</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    displayPlayerHP > 60 ? 'bg-green-500' : displayPlayerHP > 30 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${displayPlayerHP}%` }}
                />
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-red-400 font-bold">{isOnChain ? '👤 Opponent' : '🤖 AI Opponent'}</span>
                <span className="text-white font-bold">{displayEnemyHP} HP</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    displayEnemyHP > 60 ? 'bg-green-500' : displayEnemyHP > 30 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${displayEnemyHP}%` }}
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
              <span className="text-gray-400 text-xs ml-auto">Turn {displayTurn}</span>
            </div>
          </div>

          {/* Enemy Card Display */}
          {!isOnChain && (
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
          )}

          {/* Hand */}
          <div>
            <p className="text-gray-400 text-sm mb-2">Your Hand — tap a card to select it</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {DEMO_HAND.map((card) => {
                const isSelectedCard = selectedCard?.id === card.id;
                const canAfford = energy >= card.energyCost;
                return (
                  <button
                    key={card.id}
                    onClick={() => canAfford && setSelectedCard(isSelectedCard ? null : card)}
                    disabled={!canAfford || (isOnChain && !isMyTurn)}
                    className={`flex-shrink-0 w-28 rounded-xl p-3 border transition-all ${
                      isSelectedCard
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
              onClick={() => handleMove('attack')}
              disabled={!selectedCard || isMovePending || (isOnChain && !isMyTurn)}
              className="py-3 bg-red-500/20 text-red-300 font-bold rounded-xl border border-red-500/20 hover:bg-red-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {isMovePending ? '⏳' : '🗡️'} Attack
            </button>
            <button
              onClick={() => handleMove('defend')}
              disabled={!selectedCard || isMovePending || (isOnChain && !isMyTurn)}
              className="py-3 bg-blue-500/20 text-blue-300 font-bold rounded-xl border border-blue-500/20 hover:bg-blue-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              🛡️ Defend
            </button>
            <button
              onClick={() => handleMove('special')}
              disabled={!selectedCard || specialUsed || isMovePending || (isOnChain && !isMyTurn)}
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
            <div className="text-7xl mb-4">{displayEnemyHP <= 0 ? '🏆' : '💀'}</div>
            <h2 className="text-4xl font-black mb-2">
              {displayEnemyHP <= 0 ? (
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
                <div className="text-xl font-bold text-white">{displayPlayerHP}</div>
              </div>
              <div className="bg-white/5 rounded-xl px-6 py-3">
                <div className="text-gray-500">Enemy HP</div>
                <div className="text-xl font-bold text-white">{displayEnemyHP}</div>
              </div>
              <div className="bg-white/5 rounded-xl px-6 py-3">
                <div className="text-gray-500">Turns</div>
                <div className="text-xl font-bold text-white">{displayTurn - 1}</div>
              </div>
            </div>
            {displayEnemyHP <= 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-6 py-3 inline-block mb-6">
                <span className="text-green-400 font-bold">+25 RP earned</span>
                {displayTurn < 5 && <span className="text-yellow-400 ml-2">+10 Fast Win Bonus!</span>}
                {isOnChain && <span className="text-cyan-400 ml-2">(recorded on-chain ✓)</span>}
              </div>
            )}
            <div>
              <button
                onClick={() => { setPhase('lobby'); setIsOnChain(false); }}
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

export default function BattlePage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-400 animate-pulse">Loading Battle Arena...</div>}>
      <BattlePageContent />
    </Suspense>
  );
}
