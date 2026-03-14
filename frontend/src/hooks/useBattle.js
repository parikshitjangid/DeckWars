import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWatchContractEvent,
} from "wagmi";
import toast from "react-hot-toast";
import { CONTRACT_ADDRESSES, ABIS } from "../contracts";

export function useBattle() {
  const { address } = useAccount();
  const [moves, setMoves] = useState([]);

  const {
    data: activeBattleId,
    refetch: refetchActive,
  } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsBattle,
    abi: ABIS.DeckWarsBattle,
    functionName: "getActiveBattle",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const battleIdNum = activeBattleId ? Number(activeBattleId) : 0;

  const {
    data: battleData,
    isLoading,
    refetch: refetchBattle,
  } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsBattle,
    abi: ABIS.DeckWarsBattle,
    functionName: "getBattle",
    args: battleIdNum ? [BigInt(battleIdNum)] : undefined,
    query: {
      enabled: !!battleIdNum,
    },
  });

  const { writeContract, isPending } = useWriteContract();

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.DeckWarsBattle,
    abi: ABIS.DeckWarsBattle,
    eventName: "MovePlayed",
    onLogs(logs) {
      setMoves((prev) => [...prev, ...logs]);
    },
  });

  const challenge = async (opponent) => {
    if (!address) {
      toast.error("Connect your wallet first.");
      return;
    }
    let toastId;
    try {
      toastId = toast.loading("Sending challenge...");
      await writeContract({
        address: CONTRACT_ADDRESSES.DeckWarsBattle,
        abi: ABIS.DeckWarsBattle,
        functionName: "challengePlayer",
        args: [opponent],
      });
      toast.dismiss(toastId);
      toast.success("Challenge sent!");
      await refetchActive();
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      if (err?.message?.includes("user rejected")) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(err?.shortMessage || err.message || "Failed to challenge.");
      }
    }
  };

  const accept = async (battleId) => {
    let toastId;
    try {
      toastId = toast.loading("Accepting battle...");
      await writeContract({
        address: CONTRACT_ADDRESSES.DeckWarsBattle,
        abi: ABIS.DeckWarsBattle,
        functionName: "acceptBattle",
        args: [BigInt(battleId)],
      });
      toast.dismiss(toastId);
      toast.success("Battle started!");
      await Promise.all([refetchActive(), refetchBattle()]);
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      if (err?.message?.includes("user rejected")) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(err?.shortMessage || err.message || "Failed to accept.");
      }
    }
  };

  const playMove = async (battleId, move) => {
    let toastId;
    try {
      toastId = toast.loading("Submitting move...");
      await writeContract({
        address: CONTRACT_ADDRESSES.DeckWarsBattle,
        abi: ABIS.DeckWarsBattle,
        functionName: "playMove",
        args: [BigInt(battleId), move],
      });
      toast.dismiss(toastId);
      toast.success("Move played!");
      await refetchBattle();
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      if (err?.message?.includes("user rejected")) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(err?.shortMessage || err.message || "Failed to play move.");
      }
    }
  };

  const timeout = async (battleId) => {
    let toastId;
    try {
      toastId = toast.loading("Claiming timeout...");
      await writeContract({
        address: CONTRACT_ADDRESSES.DeckWarsBattle,
        abi: ABIS.DeckWarsBattle,
        functionName: "claimTimeout",
        args: [BigInt(battleId)],
      });
      toast.dismiss(toastId);
      toast.success("Timeout claimed!");
      await Promise.all([refetchActive(), refetchBattle()]);
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      if (err?.message?.includes("user rejected")) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(err?.shortMessage || err.message || "Timeout failed.");
      }
    }
  };

  useEffect(() => {
    if (!battleIdNum) setMoves([]);
  }, [battleIdNum]);

  const battle = useMemo(
    () => (battleData ? { ...battleData, id: battleIdNum } : null),
    [battleData, battleIdNum]
  );

  return {
    activeBattleId: battleIdNum,
    battleData: battle,
    moves,
    challenge,
    accept,
    playMove,
    timeout,
    isLoading: isLoading || isPending,
    refetchBattle,
  };
}

