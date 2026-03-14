import { useAccount, useReadContract, useWriteContract } from "wagmi";
import toast from "react-hot-toast";
import { CONTRACT_ADDRESSES, ABIS } from "../contracts";

export function useSeasonPass() {
  const { address } = useAccount();

  const {
    data: info,
    isLoading,
    refetch,
  } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsSeasonPass,
    abi: ABIS.DeckWarsSeasonPass,
    functionName: "getPassInfo",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract, isPending } = useWriteContract();

  const purchase = async () => {
    let toastId;
    try {
      toastId = toast.loading("Purchasing season pass...");
      await writeContract({
        address: CONTRACT_ADDRESSES.DeckWarsSeasonPass,
        abi: ABIS.DeckWarsSeasonPass,
        functionName: "purchasePass",
      });
      toast.dismiss(toastId);
      toast.success("Season pass purchased!");
      await refetch();
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      if (err?.message?.includes("Already have pass")) {
        toast.error("You already own this season pass.");
      } else if (err?.message?.includes("user rejected")) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(err?.shortMessage || err.message || "Purchase failed.");
      }
    }
  };

  const claimMilestone = async (level) => {
    let toastId;
    try {
      toastId = toast.loading("Claiming milestone...");
      await writeContract({
        address: CONTRACT_ADDRESSES.DeckWarsSeasonPass,
        abi: ABIS.DeckWarsSeasonPass,
        functionName: "claimMilestone",
        args: [BigInt(level)],
      });
      toast.dismiss(toastId);
      toast.success("Milestone claimed!");
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      if (err?.message?.includes("Milestone claimed")) {
        toast.error("Milestone already claimed.");
      } else if (err?.message?.includes("user rejected")) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(err?.shortMessage || err.message || "Claim failed.");
      }
    }
  };

  const owned = info ? Boolean(info[0]) : false;
  const level = info ? Number(info[1]) : 0;

  return {
    hasPass: owned,
    level,
    purchase,
    claimMilestone,
    isLoading: isLoading || isPending,
  };
}

