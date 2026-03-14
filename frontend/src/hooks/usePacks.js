import { useAccount, useReadContracts, useWriteContract } from "wagmi";
import toast from "react-hot-toast";
import { CONTRACT_ADDRESSES, ABIS } from "../contracts";

export function usePacks() {
  const { address } = useAccount();
  const { writeContract, isPending } = useWriteContract();
  const {
    data,
    isLoading,
    refetch,
  } = useReadContracts({
    query: { enabled: !!address },
    contracts: [0, 1, 2].map((t) => ({
      address: CONTRACT_ADDRESSES.DeckWarsPacks,
      abi: ABIS.DeckWarsPacks,
      functionName: "getPityProgress",
      args: [address, t],
    })),
  });

  const openPack = async (packType) => {
    let toastId;
    try {
      toastId = toast.loading("Opening pack...");
      await writeContract({
        address: CONTRACT_ADDRESSES.DeckWarsPacks,
        abi: ABIS.DeckWarsPacks,
        functionName: "openPack",
        args: [packType],
      });
      toast.dismiss(toastId);
      toast.success("Pack opened!");
      await refetch();
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      if (err?.message?.includes("insufficient")) {
        toast.error("Insufficient HLUSD for pack.");
      } else if (err?.message?.includes("user rejected")) {
        toast.error("Transaction rejected.");
      } else {
        toast.error(err?.shortMessage || err.message || "Pack open failed.");
      }
    }
  };

  const pityProgress = (data || []).map((entry) => {
    const [current, threshold] = entry?.result || [0n, 0n];
    return { current: Number(current), threshold: Number(threshold) };
  });

  return {
    openPack,
    pityProgress,
    isLoading: isLoading || isPending,
  };
}

