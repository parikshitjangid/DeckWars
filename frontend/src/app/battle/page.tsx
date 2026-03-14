'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { type Address } from 'viem';
import { ALL_CARDS, ELEMENT_ICONS, type CardData } from '@/config/wagmi';
import {
  useChallengePlayer, useAcceptBattle, useMakeMove, useClaimTimeout,
  useBattleState, usePlayerHand, useActiveBattle, useContractsReady,
  useApproveHLUSD, useHLUSDAllowance, useChallengeAI, useAIRewardPoolBalance,
  useAIActiveBattle,
  useAIBattleState,
  useMintHLUSD,
  useHLUSDBalance,
} from '@/hooks/useContracts';
import { CONTRACTS } from '@/config/wagmi';
import { parseUnits, formatEther, formatUnits, getAddress } from 'viem';

type BattlePhase = 'lobby' | 'matchmaking' | 'active' | 'result';
type MoveType = 'attack' | 'defend' | 'special';

const DEMO_HAND: CardData[] = [ALL_CARDS[6], ALL_CARDS[12], ALL_CARDS[3], ALL_CARDS[15], ALL_CARDS[9]];

// Helper to shuffle any array
const shuffle = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

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
  const onChainHand = usePlayerHand(activeBattleId);

  // AI Active Battle detection
  const aiActiveBattle = useAIActiveBattle();
  const aiActiveBattleId = aiActiveBattle.data ? BigInt(String(aiActiveBattle.data)) : BigInt(0);
  const aiBattleState = useAIBattleState(aiActiveBattleId);

  // Local demo state
  const [phase, setPhase] = useState<BattlePhase>('lobby');
  const [playerHP, setPlayerHP] = useState(100);
  const [enemyHP, setEnemyHP] = useState(100);
  const [energy, setEnergy] = useState(5);
  const [specialUsed, setSpecialUsed] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [turn, setTurn] = useState(1);
  
  // New TCG States
  const [playerDeck, setPlayerDeck] = useState<CardData[]>([]);
  const [playerHand, setPlayerHand] = useState<CardData[]>([]);
  const [enemyDeck, setEnemyDeck] = useState<CardData[]>([]);
  const [enemyHand, setEnemyHand] = useState<CardData[]>([]);
  const [activeEnemyCard, setActiveEnemyCard] = useState<CardData | null>(null);
  
  // Animation/Feedback States
  const [isShaking, setIsShaking] = useState(false);
  const [hitFeedback, setHitFeedback] = useState<{ id: number; text: string; type: 'hit' | 'heal' | 'dmg' }[]>([]);
  const [fatigueCount, setFatigueCount] = useState(0);
  const [opponentAddress, setOpponentAddress] = useState(initialOpponent);
  const [wagerInput, setWagerInput] = useState('0');
  const [aiWagerInput, setAiWagerInput] = useState('0');
  const [isOnChain, setIsOnChain] = useState(false);

  // Wager approvals
  const { 
    approve: approveHLUSD, 
    isPending: isApprovePending, 
    isSuccess: isApproveSuccess,
    error: approveError 
  } = useApproveHLUSD();
  
  // PvP Wager Allowance
  const hlusdAllowance = useHLUSDAllowance(CONTRACTS.BattleEngine as Address);
  const allowanceValue = hlusdAllowance.data ? (hlusdAllowance.data as bigint) : BigInt(0);

  // AI Wager Allowance
  const { data: aiAllowance, refetch: refetchAiAllowance } = useHLUSDAllowance(CONTRACTS.AIBattleAgent as Address);
  const aiAllowanceValue = aiAllowance ? BigInt(aiAllowance as unknown as string) : BigInt(0);

  // AI Rewards
  const { data: aiRewardPool } = useAIRewardPoolBalance();
  const { challengeAI, isPending: isAiChallengePending, isSuccess: isAiChallengeSuccess, error: aiChallengeError } = useChallengeAI();

  // Test Tokens
  const { mint: mintHLUSD, isPending: isMintPending } = useMintHLUSD();
  const { data: userHlusdBalance, refetch: refetchBalance } = useHLUSDBalance();

  // Check for active on-chain PvP battle
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

  // Check for active on-chain AI battle
  useEffect(() => {
    if (aiActiveBattleId > BigInt(0) && aiBattleState.data) {
      // If we find an AI battle, we treat it as an active battle session
      setIsOnChain(true);
      setPhase('active');
      setLog(prev => [...prev, '🤖 On-chain AI Battle detected! Lets play.']);
      
      // Initialize local state for the AI play session (even though wager is on-chain)
      setPlayerHP(100);
      setEnemyHP(100);
      setEnergy(5);
      setTurn(1);
    }
  }, [aiActiveBattleId, aiBattleState.data]);

  const startDemoBattle = () => {
    const wagerWei = parseUnits(aiWagerInput || '0', 18);
    
    // If wager is set > 0, do the real on-chain AI battle
    if (wagerWei > BigInt(0)) {
      if (!contractsReady) {
        alert("Contracts not ready. Please connect wallet.");
        return;
      }
      
      if (aiAllowanceValue < wagerWei && !isApproveSuccess) {
        // Try one last refetch before blocking
        refetchAiAllowance();
        // If still low, we don't block with alert, we let the UI handle it via disabled state or msg
      }

      console.log('⚔️ Starting On-Chain AI Battle with wager:', formatUnits(wagerWei, 18), 'HLUSD');
      challengeAI(BigInt(0), 1, wagerWei);
      setPhase('matchmaking');
      setLog(['📡 AI Challenge sent on-chain. Wager: ' + aiWagerInput + ' HLUSD']);
      return;
    }

    // Otherwise, start a free local demo battle
    console.log('🤖 Starting Local Demo Battle (Free)');
    setIsOnChain(false);
    setPhase('active');
    setPlayerHP(100);
    setEnemyHP(100);
    setEnergy(5);
    setSpecialUsed(false);
    setSelectedCard(null);
    setLog(['⚔️ Battle started! Your turn.']);
    setTurn(1);
    setFatigueCount(0);

    // Initialize Decks (shuffled full set)
    const fullSet = shuffle([...ALL_CARDS]);
    const pDeck = fullSet.slice(0, 15);
    const pHand = fullSet.slice(15, 20);
    const eDeck = shuffle([...ALL_CARDS]).slice(0, 15);
    const eHand = shuffle([...ALL_CARDS]).slice(15, 20);

    setPlayerDeck(pDeck);
    setPlayerHand(pHand);
    setEnemyDeck(eDeck);
    setEnemyHand(eHand);
    setActiveEnemyCard(eHand[0]); // Start with the first card in hand
  };

  const startOnChainBattle = () => {
    if (!contractsReady || !opponentAddress) return;
    setIsOnChain(true);
    const wagerWei = parseUnits(wagerInput || '0', 18);
    challenge(opponentAddress as Address, BigInt(0), wagerWei);
    setPhase('matchmaking');
    setLog(['📡 Challenge sent on-chain. Waiting for opponent to accept...']);
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const addFeedback = (text: string, type: 'hit' | 'heal' | 'dmg') => {
    const id = Date.now();
    setHitFeedback(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setHitFeedback(prev => prev.filter(f => f.id !== id));
    }, 1500);
  };

  const drawCard = (isPlayer: boolean) => {
    if (isPlayer) {
      if (playerDeck.length === 0) return;
      const newDeck = [...playerDeck];
      const nextCard = newDeck.pop();
      if (nextCard) {
        setPlayerDeck(newDeck);
        setPlayerHand(prev => [...prev, nextCard]);
      }
    } else {
      if (enemyDeck.length === 0) return;
      const newDeck = [...enemyDeck];
      const nextCard = newDeck.pop();
      if (nextCard) {
        setEnemyDeck(newDeck);
        setEnemyHand(prev => [...prev, nextCard]);
      }
    }
  };

  const makeLocalMove = (move: MoveType | 'pass') => {
    if (move !== 'pass' && !selectedCard) return;
    if (move !== 'pass' && !activeEnemyCard) return;

    const card = selectedCard;
    const enemyCard = activeEnemyCard!;
    
    let playerMoveLog = '';
    let enemyMoveLog = '';
    let pDamageToEnemy = 0;
    let eDamageToPlayer = 0;
    
    // 1. Resolve Player Move
    if (move === 'pass') {
      playerMoveLog = '⏸️ You passed your turn to recover energy';
      setFatigueCount(f => f + 1);
      if (fatigueCount >= 2) {
        const fatigueDmg = (fatigueCount - 1) * 5;
        setPlayerHP(p => Math.max(0, p - fatigueDmg));
        addFeedback(`-${fatigueDmg} Fatigue`, 'dmg');
        playerMoveLog += ` (Fatigue hits for ${fatigueDmg}!)`;
      }
    } else {
      setFatigueCount(0);
      const cost = card!.energyCost;
      if (energy < cost) return;
      
      const hasAdvantage = (
        (card!.element === 'Fire' && enemyCard.element === 'Earth') ||
        (card!.element === 'Earth' && enemyCard.element === 'Water') ||
        (card!.element === 'Water' && enemyCard.element === 'Fire')
      );

      if (move === 'attack') {
        pDamageToEnemy = Math.max(1, card!.attack - enemyCard.defense);
        if (hasAdvantage) {
          pDamageToEnemy += 3;
          addFeedback('Super Effective! 🔥', 'hit');
        }
        playerMoveLog = `🗡️ ${card!.name} deals ${pDamageToEnemy} dmg`;
      } else if (move === 'defend') {
        playerMoveLog = `🛡️ ${card!.name} braces for impact`;
      } else if (move === 'special') {
        setSpecialUsed(true);
        pDamageToEnemy = Math.max(1, card!.attack - enemyCard.defense) * 2;
        if (hasAdvantage) pDamageToEnemy += 6;
        playerMoveLog = `💥 ${card!.name} uses SPECIAL for ${pDamageToEnemy} dmg!`;
        triggerShake();
      }

      setEnergy(e => Math.min(10, (e - cost) + 3));
      setEnemyHP(h => Math.max(0, h - pDamageToEnemy));
      if (pDamageToEnemy > 0) addFeedback(`-${pDamageToEnemy}`, 'dmg');

      // Remove card from hand and draw new one
      setPlayerHand(prev => prev.filter(c => c.id !== card!.id));
      drawCard(true);
    }

    // 2. Resolve Enemy Counter (AI draws random card and move)
    const eHand = [...enemyHand];
    const aiCard = eHand[Math.floor(Math.random() * eHand.length)];
    setActiveEnemyCard(aiCard);

    // AI logic: 70% attack, 30% defend
    const aiMove = Math.random() > 0.3 ? 'attack' : 'defend';
    
    const eHasAdvantage = (
      (aiCard.element === 'Fire' && (card?.element || 'Earth') === 'Earth') ||
      (aiCard.element === 'Earth' && (card?.element || 'Water') === 'Water') ||
      (aiCard.element === 'Water' && (card?.element || 'Fire') === 'Fire')
    );

    if (aiMove === 'attack') {
      eDamageToPlayer = Math.max(1, aiCard.attack - (move === 'defend' ? (card?.defense || 0) + 2 : (card?.defense || 0)));
      if (eHasAdvantage) eDamageToPlayer += 2;
      enemyMoveLog = `↩️ ${aiCard.name} counters for ${eDamageToPlayer} dmg`;
      if (move !== 'defend') triggerShake();
    } else {
      enemyMoveLog = `↩️ ${aiCard.name} takes a defensive stance`;
    }

    setPlayerHP(p => Math.max(0, p - eDamageToPlayer));
    if (eDamageToPlayer > 0) addFeedback(`-${eDamageToPlayer} HP`, 'dmg');

    setLog(prev => [...prev, `Turn ${turn}: ${playerMoveLog}`, `  ${enemyMoveLog}`]);
    
    // Cycle AI hand
    setEnemyHand(prev => prev.filter(c => c.id !== aiCard.id));
    drawCard(false);

    setTurn(t => t + 1);
    setSelectedCard(null);

    // Check Win/Loss
    if (enemyHP - pDamageToEnemy <= 0 || playerHP - eDamageToPlayer <= 0) {
      setPhase('result');
    }
  };

  const handleMove = (move: MoveType | 'pass') => {
    if (isOnChain && contractsReady && selectedCard && move !== 'pass') {
      const onChainData = onChainHand.data as any[];
      const handIndex = onChainData?.findIndex((c: any) => BigInt(c.id) === BigInt(selectedCard.id)) ?? -1;
      const moveType = move === 'attack' ? 0 : move === 'defend' ? 1 : 2;
      if (handIndex !== -1) {
        makeMoveOnChain(activeBattleId, BigInt(handIndex), moveType);
      }
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
    <div className={`max-w-5xl mx-auto px-4 sm:px-6 py-6 transition-transform duration-100 ${isShaking ? 'shake-anim' : ''}`}>
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          50% { transform: translateX(10px); }
          75% { transform: translateX(-10px); }
        }
        .shake-anim {
          animation: shake 0.5s ease-in-out;
        }
        @keyframes fade-up {
          0% { opacity: 0; transform: translateY(0); }
          20% { opacity: 1; transform: translateY(-20px); }
          100% { opacity: 0; transform: translateY(-40px); }
        }
        .animate-fade-up {
          animation: fade-up 1.5s ease-out forwards;
        }
      `}</style>

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
                  <div className="flex justify-between items-center mb-1 text-[10px]">
                    <span className="text-gray-400">Your Balance:</span>
                    <span className="text-white font-mono">{userHlusdBalance !== undefined ? formatEther(userHlusdBalance as bigint) : '...'} HLUSD</span>
                  </div>
                  
                  {aiRewardPool !== undefined && (
                    <div className="flex justify-between items-center mb-2 text-[10px]">
                      <span className="text-gray-400">AI Pool:</span>
                      <span className={`${BigInt(aiRewardPool as string) === BigInt(0) ? 'text-red-500 font-bold' : 'text-amber-500'} font-mono`}>
                        {formatEther(aiRewardPool as bigint)} HLUSD
                      </span>
                    </div>
                  )}

                  {BigInt(userHlusdBalance || 0) < parseUnits(aiWagerInput || '0', 18) && parseUnits(aiWagerInput || '0', 18) > BigInt(0) && (
                    <div className="text-red-400 text-[10px] mb-2 text-center bg-red-500/10 p-2 rounded border border-red-500/20">
                      <p>❌ You need more HLUSD to make this bet.</p>
                      <button 
                         onClick={() => mintHLUSD('100')}
                         disabled={isMintPending}
                         className="mt-1 text-blue-400 underline cursor-pointer hover:text-blue-300"
                      >
                         {isMintPending ? 'Minting...' : 'Get 100 Test HLUSD'}
                      </button>
                    </div>
                  )}

                  {BigInt(aiRewardPool || 0) === BigInt(0) && parseUnits(aiWagerInput || '0', 18) > BigInt(0) && (
                    <div className="text-red-500 text-[10px] mb-2 text-center bg-red-500/10 p-2 rounded border border-red-500/20">
                      <p className="font-bold">⚠️ AI Pool is empty.</p>
                      <p>The contract will reject wagers until the developer funds it.</p>
                    </div>
                  )}

                  {approveError && (
                    <p className="text-red-500 text-[10px] mb-2 text-center bg-red-500/10 p-2 rounded border border-red-500/20">
                      Approval Error: {approveError.message.includes('User denied') ? 'Transaction rejected' : 'Check balance/gas'}
                    </p>
                  )}

                  {aiChallengeError && (
                    <p className="text-red-500 text-[10px] mb-2 text-center bg-red-500/10 p-2 rounded border border-red-500/20">
                      Battle Error: {aiChallengeError.message.includes('Insufficient') ? 'Reward Pool is empty' : 'Check wallet/balance'}
                    </p>
                  )}

                  {/* Approval / Battle Buttons */}
                  {parseUnits(aiWagerInput || '0', 18) > BigInt(0) && aiAllowanceValue < parseUnits(aiWagerInput || '0', 18) && !isApproveSuccess ? (
                    <div className="space-y-2">
                        <button
                        onClick={() => {
                          console.log('💎 Approving AI Wager:', aiWagerInput);
                          approveHLUSD(CONTRACTS.AIBattleAgent as Address, parseUnits(aiWagerInput, 18));
                        }}
                        disabled={isApprovePending}
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-all cursor-pointer disabled:opacity-40"
                      >
                        {isApprovePending ? '⏳ Awaiting Wallet...' : '🔐 Step 1: Set Allowance'}
                      </button>
                      <p className="text-[10px] text-gray-400 text-center px-4 leading-tight">
                        <b>Step 1: Permission.</b> Your wallet will show <b>0 HLUSD</b> for this step. This just gives the game permission to use your tokens.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {isApproveSuccess && (
                        <p className="text-green-400 text-[10px] text-center font-bold mb-1">✅ Permission Granted! Now start the battle.</p>
                      )}
                      {parseUnits(aiWagerInput || '0', 18) > BigInt(0) && (
                         <p className="text-[10px] text-orange-400 text-center px-4 leading-tight">
                            <b>Step 2: Battle.</b> The 1 HLUSD wager will be sent in this transaction.
                         </p>
                      )}
                      <button
                        onClick={startDemoBattle}
                        disabled={isAiChallengePending}
                        className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-black rounded-xl hover:shadow-lg hover:shadow-orange-500/40 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isAiChallengePending ? '⏳ Creating Match...' : (parseUnits(aiWagerInput || '0', 18) > BigInt(0) ? '⚔️ Start Battle (Wager)' : '🤖 Start Battle (Free)')}
                      </button>
                    </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
            {/* Feedback system */}
            <div className="absolute inset-0 pointer-events-none z-50">
              {hitFeedback.map(f => (
                <div 
                  key={f.id} 
                  className={`absolute left-1/2 -ml-4 font-black text-2xl animate-fade-up ${
                    f.type === 'dmg' ? 'text-red-500' : 'text-green-500'
                  }`}
                  style={{ top: '20%' }}
                >
                  {f.text}
                </div>
              ))}
            </div>

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
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-6 h-3 rounded-full transition-all ${
                      i < energy ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-gray-800'
                    }`}
                  />
                ))}
              </div>
              <span className="text-gray-400 text-xs ml-auto">Turn {displayTurn}</span>
            </div>
            {fatigueCount > 1 && (
              <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ FATIGUE WARNING: passing turns will drain HP!</p>
            )}
          </div>

          {/* Enemy Card Display */}
          {!isOnChain && activeEnemyCard && (
            <div className="text-center py-4">
              <p className="text-gray-500 text-xs mb-2">Enemy&apos;s Active Card</p>
              <div className="inline-flex items-center gap-3 bg-red-500/10 rounded-xl px-6 py-3 border border-red-500/20 animate-pulse">
                <span className="text-2xl">{ELEMENT_ICONS[activeEnemyCard.element]}</span>
                <div className="text-left">
                  <p className="text-white font-bold text-sm">{activeEnemyCard.name}</p>
                  <p className="text-gray-400 text-xs">⚔ {activeEnemyCard.attack} | 🛡 {activeEnemyCard.defense}</p>
                </div>
              </div>
            </div>
          )}

          {/* Hand */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-gray-400 text-sm">Your Hand — tap a card to select it</p>
              <p className="text-gray-600 text-[10px] font-bold uppercase tracking-wider">Deck: {playerDeck.length} left</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {(isOnChain ? DEMO_HAND : playerHand).map((card) => {
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
                          ? 'bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer hover:-translate-y-1'
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => handleMove('attack')}
              disabled={!selectedCard || isMovePending || (isOnChain && !isMyTurn)}
              className="py-3 bg-gradient-to-br from-red-500/30 to-red-600/10 text-red-100 font-bold rounded-xl border border-red-500/30 hover:shadow-lg hover:shadow-red-500/10 transition-all disabled:opacity-30 cursor-pointer"
            >
              {isMovePending ? '⏳' : '🗡️'} Attack
            </button>
            <button
              onClick={() => handleMove('defend')}
              disabled={!selectedCard || isMovePending || (isOnChain && !isMyTurn)}
              className="py-3 bg-gradient-to-br from-blue-500/30 to-blue-600/10 text-blue-100 font-bold rounded-xl border border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10 transition-all disabled:opacity-30 cursor-pointer"
            >
              🛡️ Defend
            </button>
            <button
              onClick={() => handleMove('special')}
              disabled={!selectedCard || specialUsed || isMovePending || (isOnChain && !isMyTurn)}
              className={`py-3 font-bold rounded-xl border transition-all cursor-pointer ${
                specialUsed
                  ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed'
                  : 'bg-gradient-to-br from-purple-500/30 to-purple-600/10 text-purple-100 border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/10 disabled:opacity-30'
              }`}
            >
              💥 Ultimate {specialUsed ? '(Used)' : ''}
            </button>
            <button
              onClick={() => handleMove('pass')}
              disabled={isMovePending || (isOnChain && !isMyTurn)}
              className="py-3 bg-gradient-to-br from-gray-500/30 to-gray-600/10 text-gray-100 font-bold rounded-xl border border-gray-500/30 hover:bg-gray-500/40 transition-all disabled:opacity-30 cursor-pointer"
            >
              ⏸️ Pass Turn
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
