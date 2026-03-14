import { useAccount, useReadContracts, useWriteContract } from "wagmi";
import toast from "react-hot-toast";
import { CONTRACT_ADDRESSES, ABIS } from "../contracts";

export function useQuest() {
  const { address } = useAccount();

  const {
    data,
    isLoading,
    refetch,
  } = useReadContracts({
    query: { enabled: !!address },
    contracts: [
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "quests",
        args: [0],
      },
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "quests",
        args: [1],
      },
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "quests",
        args: [2],
      },
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "quests",
        args: [3],
      },
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "quests",
        args: [4],
      },
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "progress",
        args: [address, 0],
      },
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "progress",
        args: [address, 1],
      },
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "progress",
        args: [address, 2],
      },
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "progress",
        args: [address, 3],
      },
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "progress",
        args: [address, 4],
      },
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "claimed",
        args: [address, 0],
      },
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "claimed",
        args: [address, 1],
      },
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "claimed",
        args: [address, 2],
      },
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "claimed",
        args: [address, 3],
      },
      {
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "claimed",
        args: [address, 4],
      },
    ],
  });

  const { writeContract, isPending } = useWriteContract();

  const claim = async (questId) => {
    let toastId;
    try {
      toastId = toast.loading("Claiming quest reward...");
      await writeContract({
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "claimQuest",
        args: [BigInt(questId)],
      });
      toast.dismiss(toastId);
      toast.success("Quest reward claimed!");
      await refetch();
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      if (err?.message?.includes("already claimed")) {
        toast.error("Quest already claimed.");
      } else if (err?.message?.includes("user rejected")) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(err?.shortMessage || err.message || "Quest claim failed.");
      }
    }
  };

  const vote = async (cardId) => {
    let toastId;
    try {
      toastId = toast.loading("Submitting vote...");
      await writeContract({
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "voteForCard",
        args: [BigInt(cardId)],
      });
      toast.dismiss(toastId);
      toast.success("Vote submitted!");
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      if (err?.message?.includes("Already voted")) {
        toast.error("You already voted this season.");
      } else if (err?.message?.includes("user rejected")) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(err?.shortMessage || err.message || "Vote failed.");
      }
    }
  };

  const checkCollector = async () => {
    let toastId;
    try {
      toastId = toast.loading("Checking collection quest...");
      await writeContract({
        address: CONTRACT_ADDRESSES.DeckWarsQuest,
        abi: ABIS.DeckWarsQuest,
        functionName: "checkCollector",
        args: [address],
      });
      toast.dismiss(toastId);
      toast.success("Collection checked!");
      await refetch();
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      if (err?.message?.includes("user rejected")) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(err?.shortMessage || err.message || "Check failed.");
      }
    }
  };

  if (!data) {
    return {
      quests: [],
      isLoading: isLoading || isPending,
      claim,
      vote,
      checkCollector,
    };
  }

  const quests = Array.from({ length: 5 }, (_, i) => {
    const q = data[i]?.result;
    const prog = data[5 + i]?.result || 0n;
    const isClaimed = Boolean(data[10 + i]?.result);
    return {
      id: i,
      name: q?.[0] ?? "",
      description: q?.[1] ?? "",
      goal: Number(q?.[2] ?? 0n),
      rewardCardId: Number(q?.[3] ?? 0n),
      active: Boolean(q?.[4]),
      progress: Number(prog),
      claimed: isClaimed,
    };
  });

  return {
    quests,
    isLoading: isLoading || isPending,
    claim,
    vote,
    checkCollector,
  };
}

