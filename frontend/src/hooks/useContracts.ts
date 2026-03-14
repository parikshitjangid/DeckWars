'use client';

import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { type Address, parseEther, erc20Abi, maxUint256 } from 'viem';
import { CONTRACTS } from '@/config/wagmi';

/* ── ABI imports ─────────────────────────────────────────────── */
import CardNFTAbi from '@/abis/CardNFT.json';
import DeckManagerAbi from '@/abis/DeckManager.json';
import BattleEngineAbi from '@/abis/BattleEngine.json';
import CraftingSystemAbi from '@/abis/CraftingSystem.json';
import PremiumPacksAbi from '@/abis/PremiumPacks.json';
import SeasonPassAbi from '@/abis/SeasonPass.json';
import RankSystemAbi from '@/abis/RankSystem.json';
import QuestSystemAbi from '@/abis/QuestSystem.json';
import SeasonEngineAbi from '@/abis/SeasonEngine.json';
import AIBattleAgentAbi from '@/abis/AIBattleAgent.json';

/* ── Helper: only create contract config if address is set ──── */
function contractConfig(address: string, abi: any) {
  if (!address || address === '0x...' || address === '') return null;
  return { address: address as Address, abi } as const;
}

// ─────────────────────────────────────────────────────────────────
// CardNFT hooks
// ─────────────────────────────────────────────────────────────────

/** Read how many of a specific card a player owns */
export function useCardBalance(tokenId: number) {
  const { address } = useAccount();
  const cfg = contractConfig(CONTRACTS.CardNFT, CardNFTAbi);
  return useReadContract(cfg ? {
    ...cfg,
    functionName: 'balanceOf',
    args: [address!, BigInt(tokenId)],
    query: { enabled: !!address && !!cfg },
  } : undefined);
}

/** Read all 20 card balances for the connected wallet */
export function useAllCardBalances() {
  const { address } = useAccount();
  const cfg = contractConfig(CONTRACTS.CardNFT, CardNFTAbi);
  // We read individual balances since ERC-1155 doesn't have a batch view for one account
  const results = Array.from({ length: 20 }, (_, i) => {
    const tokenId = i + 1;
    return useReadContract(cfg ? {
      ...cfg,
      functionName: 'balanceOf',
      args: [address!, BigInt(tokenId)],
      query: { enabled: !!address && !!cfg },
    } : undefined);
  });
  return results;
}

/** Read card stats from the contract */
export function useCardStats(tokenId: number) {
  const cfg = contractConfig(CONTRACTS.CardNFT, CardNFTAbi);
  return useReadContract(cfg ? {
    ...cfg,
    functionName: 'getCardStats',
    args: [BigInt(tokenId)],
    query: { enabled: !!cfg },
  } : undefined);
}

// ─────────────────────────────────────────────────────────────────
// DeckManager hooks
// ─────────────────────────────────────────────────────────────────

/** Register a new deck on-chain */
export function useRegisterDeck() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const cfg = contractConfig(CONTRACTS.DeckManager, DeckManagerAbi);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const registerDeck = (cardIds: number[]) => {
    if (!cfg) return;
    writeContract({
      ...cfg,
      functionName: 'registerDeck',
      args: [cardIds.map(BigInt)],
    });
  };

  return { registerDeck, isPending, isConfirming, isSuccess, error, hash };
}

// ─────────────────────────────────────────────────────────────────
// BattleEngine hooks
// ─────────────────────────────────────────────────────────────────

/** Challenge another player */
export function useChallengePlayer() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const cfg = contractConfig(CONTRACTS.BattleEngine, BattleEngineAbi);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const challenge = (opponent: Address, deckId: bigint, wagerAmount: bigint) => {
    if (!cfg) return;
    writeContract({
      ...cfg,
      functionName: 'challengePlayer',
      args: [opponent, deckId, wagerAmount],
    });
  };

  return { challenge, isPending, isConfirming, isSuccess, error, hash };
}

/** Accept a pending battle */
export function useAcceptBattle() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const cfg = contractConfig(CONTRACTS.BattleEngine, BattleEngineAbi);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const accept = (battleId: bigint, deckId: bigint, wagerAmount: bigint) => {
    if (!cfg) return;
    writeContract({
      ...cfg,
      functionName: 'acceptBattle',
      args: [battleId, deckId, wagerAmount],
    });
  };

  return { accept, isPending, isConfirming, isSuccess, error, hash };
}

/** Make a move in an active battle */
export function useMakeMove() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const cfg = contractConfig(CONTRACTS.BattleEngine, BattleEngineAbi);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const makeMove = (battleId: bigint, handIndex: bigint, moveType: number) => {
    if (!cfg) return;
    writeContract({
      ...cfg,
      functionName: 'makeMove',
      args: [battleId, handIndex, moveType],
    });
  };

  return { makeMove, isPending, isConfirming, isSuccess, error, hash };
}

/** Claim timeout victory */
export function useClaimTimeout() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const cfg = contractConfig(CONTRACTS.BattleEngine, BattleEngineAbi);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimTimeout = (battleId: bigint) => {
    if (!cfg) return;
    writeContract({
      ...cfg,
      functionName: 'claimTimeout',
      args: [battleId],
    });
  };

  return { claimTimeout, isPending, isConfirming, isSuccess, error, hash };
}

/** Read battle state */
export function useBattleState(battleId: bigint) {
  const cfg = contractConfig(CONTRACTS.BattleEngine, BattleEngineAbi);
  return useReadContract(cfg ? {
    ...cfg,
    functionName: 'getBattle',
    args: [battleId],
    query: { enabled: !!cfg && battleId > BigInt(0), refetchInterval: 5000 },
  } : undefined);
}

/** Read player's hand in a battle */
export function usePlayerHand(battleId: bigint) {
  const { address } = useAccount();
  const cfg = contractConfig(CONTRACTS.BattleEngine, BattleEngineAbi);
  return useReadContract(cfg ? {
    ...cfg,
    functionName: 'getPlayerHand',
    args: [battleId, address!],
    query: { enabled: !!cfg && !!address && battleId > BigInt(0), refetchInterval: 5000 },
  } : undefined);
}

/** Check if player has an active battle */
export function useActiveBattle() {
  const { address } = useAccount();
  const cfg = contractConfig(CONTRACTS.BattleEngine, BattleEngineAbi);
  return useReadContract(cfg ? {
    ...cfg,
    functionName: 'activeBattle',
    args: [address!],
    query: { enabled: !!address && !!cfg, refetchInterval: 5000 },
  } : undefined);
}

// ─────────────────────────────────────────────────────────────────
// CraftingSystem hooks
// ─────────────────────────────────────────────────────────────────

/** Craft 3 cards → 1 higher rarity card */
export function useCraft() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const cfg = contractConfig(CONTRACTS.CraftingSystem, CraftingSystemAbi);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const craft = (tokenIds: number[]) => {
    if (!cfg) return;
    writeContract({
      ...cfg,
      functionName: 'craft',
      args: [tokenIds.map(BigInt)],
    });
  };

  return { craft, isPending, isConfirming, isSuccess, error, hash };
}

// ─────────────────────────────────────────────────────────────────
// PremiumPacks hooks
// ─────────────────────────────────────────────────────────────────

/** Approve HLUSD spending then open a pack */
export function useApproveHLUSD() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (spender: Address, amount: bigint = maxUint256) => {
    console.log('💎 useApproveHLUSD: Attempting approval...', {
      hlusd: CONTRACTS.HLUSD,
      spender,
      amount: amount.toString()
    });
    
    if (!CONTRACTS.HLUSD) {
      console.error('❌ useApproveHLUSD: HLUSD address is MISSING in config!');
      return;
    }
    
    if (!spender || spender === '0x...') {
      console.error('❌ useApproveHLUSD: Spender address is INVALID!', spender);
      return;
    }

    writeContract({
      address: CONTRACTS.HLUSD as Address,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amount],
    });
  };

  return { approve, isPending, isConfirming, isSuccess, error, hash };
}

/** Open a pack (tier: 0=Silver, 1=Gold, 2=Diamond) */
export function useOpenPack() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const cfg = contractConfig(CONTRACTS.PremiumPacks, PremiumPacksAbi);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const openPack = (tier: number) => {
    if (!cfg) return;
    writeContract({
      ...cfg,
      functionName: 'openPack',
      args: [tier],
    });
  };

  return { openPack, isPending, isConfirming, isSuccess, error, hash };
}

/** Read HLUSD balance */
export function useHLUSDBalance() {
  const { address } = useAccount();
  return useReadContract(CONTRACTS.HLUSD ? {
    address: CONTRACTS.HLUSD as Address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  } : undefined);
}

/** Read HLUSD allowance for a specific spender */
export function useHLUSDAllowance(spender: Address) {
  const { address } = useAccount();
  return useReadContract(CONTRACTS.HLUSD ? {
    address: CONTRACTS.HLUSD as Address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address!, spender],
    query: { enabled: !!address && !!spender, refetchInterval: 5000 },
  } : undefined);
}

// ─────────────────────────────────────────────────────────────────
// RankSystem hooks
// ─────────────────────────────────────────────────────────────────

/** Read player stats (totalRP, currentSeasonRP, wins, losses, rank, exists) */
export function usePlayerStats() {
  const { address } = useAccount();
  const cfg = contractConfig(CONTRACTS.RankSystem, RankSystemAbi);
  return useReadContract(cfg ? {
    ...cfg,
    functionName: 'getPlayerStats',
    args: [address!],
    query: { enabled: !!address && !!cfg },
  } : undefined);
}

/** Read leaderboard */
export function useLeaderboard() {
  const cfg = contractConfig(CONTRACTS.RankSystem, RankSystemAbi);
  return useReadContract(cfg ? {
    ...cfg,
    functionName: 'getLeaderboard',
    query: { enabled: !!cfg },
  } : undefined);
}

// ─────────────────────────────────────────────────────────────────
// QuestSystem hooks
// ─────────────────────────────────────────────────────────────────

/** Read a specific quest for current season */
export function useQuest(questId: number) {
  const cfg = contractConfig(CONTRACTS.QuestSystem, QuestSystemAbi);
  return useReadContract(cfg ? {
    ...cfg,
    functionName: 'seasonQuests',
    args: [BigInt(1) /* current season */, BigInt(questId)],
    query: { enabled: !!cfg },
  } : undefined);
}

/** Read player quest progress */
export function useQuestProgress(questId: number) {
  const { address } = useAccount();
  const cfg = contractConfig(CONTRACTS.QuestSystem, QuestSystemAbi);
  return useReadContract(cfg ? {
    ...cfg,
    functionName: 'playerQuestData',
    args: [BigInt(1), address!, BigInt(questId)],
    query: { enabled: !!address && !!cfg },
  } : undefined);
}

/** Claim a completed quest reward */
export function useClaimQuest() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const cfg = contractConfig(CONTRACTS.QuestSystem, QuestSystemAbi);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claim = (seasonId: bigint, questId: bigint) => {
    if (!cfg) return;
    writeContract({
      ...cfg,
      functionName: 'claimQuestReward',
      args: [seasonId, questId],
    });
  };

  return { claim, isPending, isConfirming, isSuccess, error, hash };
}

/** Vote for next season's featured card */
export function useVoteCard() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const cfg = contractConfig(CONTRACTS.QuestSystem, QuestSystemAbi);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const vote = (cardId: bigint) => {
    if (!cfg) return;
    writeContract({
      ...cfg,
      functionName: 'voteForCard',
      args: [cardId],
    });
  };

  return { vote, isPending, isConfirming, isSuccess, error, hash };
}

// ─────────────────────────────────────────────────────────────────
// Utility: check if contracts are configured
// ─────────────────────────────────────────────────────────────────

export function useContractsReady() {
  const hasContracts = Object.values(CONTRACTS).some(
    (addr) => addr && addr !== '' && addr !== '0x...'
  );
  return hasContracts;
}

// ─────────────────────────────────────────────────────────────────
// AIBattleAgent hooks
// ─────────────────────────────────────────────────────────────────

/** Challenge AI */
export function useChallengeAI() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const cfg = contractConfig(CONTRACTS.AIBattleAgent, AIBattleAgentAbi);
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const challengeAI = (deckId: bigint, difficulty: number, wagerAmount: bigint) => {
    if (!cfg) return;
    writeContract({
      ...cfg,
      functionName: 'challengeAI',
      args: [deckId, difficulty, wagerAmount],
    });
  };

  return { challengeAI, isPending, isConfirming, isSuccess, error, hash };
}

/** Check AI Reward Pool */
export function useAIRewardPoolBalance() {
  const cfg = contractConfig(CONTRACTS.AIBattleAgent, AIBattleAgentAbi);
  return useReadContract(cfg ? {
    ...cfg,
    functionName: 'getRewardPoolBalance',
    query: { enabled: !!cfg },
  } : undefined);
}

/** Check if player has an active AI battle */
export function useAIActiveBattle() {
  const { address } = useAccount();
  const cfg = contractConfig(CONTRACTS.AIBattleAgent, AIBattleAgentAbi);
  return useReadContract(cfg ? {
    ...cfg,
    functionName: 'activeBattle',
    args: [address!],
    query: { enabled: !!address && !!cfg, refetchInterval: 5000 },
  } : undefined);
}

/** Read AI battle state */
export function useAIBattleState(battleId: bigint) {
  const cfg = contractConfig(CONTRACTS.AIBattleAgent, AIBattleAgentAbi);
  return useReadContract(cfg ? {
    ...cfg,
    functionName: 'getBattle',
    args: [battleId],
    query: { enabled: !!cfg && battleId > BigInt(0), refetchInterval: 5000 },
  } : undefined);
}
