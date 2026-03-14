import React, { useState } from "react";
import { useAccount } from "wagmi";
import { useBattle } from "../hooks/useBattle";
import { useCards } from "../hooks/useCards";
import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, ABIS } from "../contracts";
import HPBar from "../components/HPBar";
import CardDisplay from "../components/CardDisplay";
import LoadingSpinner from "../components/LoadingSpinner";

const MOVE_ATTACK = 0;
const MOVE_DEFEND = 1;
const MOVE_SPECIAL = 2;

function shorten(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function useBattleEvents(battleId) {
  const { data: moves } = useReadContract({
    address: CONTRACT_ADDRESSES.DeckWarsBattle,
    abi: ABIS.DeckWarsBattle,
    functionName: "getBattle",
    args: battleId ? [BigInt(battleId)] : undefined,
    query: { enabled: !!battleId },
  });
  return moves;
}

export default function BattleArena() {
  const { address } = useAccount();
  const {
    activeBattleId,
    battleData: battle,
    challenge,
    accept,
    playMove,
    timeout,
    isLoading,
  } = useBattle();
  const { cards } = useCards();
  const [opponentInput, setOpponentInput] = useState("");
  const [tab, setTab] = useState("find");

  const isPlayerA = battle?.playerA?.toLowerCase() === address?.toLowerCase();
  const isPlayerB = battle?.playerB?.toLowerCase() === address?.toLowerCase();
  const isMyTurn =
    (battle?.currentTurn === 0 && isPlayerA) ||
    (battle?.currentTurn === 1 && isPlayerB);
  const specialUsed = isPlayerA ? battle?.specialUsedA : battle?.specialUsedB;
  const lastMoveTime = battle?.lastMoveTime ? Number(battle.lastMoveTime) : 0;
  const turnTimer = 300;
  const deadline = lastMoveTime + turnTimer;

  const cardForId = (id) => cards.find((c) => c.id === Number(id));

  const handleChallenge = () => {
    if (!opponentInput.trim()) return;
    challenge(opponentInput.trim());
  };

  const handlePlayMove = (move) => {
    if (!activeBattleId || !isMyTurn) return;
    playMove(activeBattleId, move);
  };

  const handleTimeout = () => {
    if (!activeBattleId) return;
    timeout(activeBattleId);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Battle Arena</h1>

      <div className="flex gap-2 border-b border-[#2a2a3a]">
        <button
          onClick={() => setTab("find")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "find"
              ? "text-[var(--accent-purple)] border-b-2 border-[var(--accent-purple)]"
              : "text-[var(--text-secondary)]"
          }`}
        >
          Find Battle
        </button>
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "active"
              ? "text-[var(--accent-purple)] border-b-2 border-[var(--accent-purple)]"
              : "text-[var(--text-secondary)]"
          }`}
        >
          Active Battle
        </button>
      </div>

      {tab === "find" && (
        <div className="rounded-lg bg-[#12121a] p-6 space-y-4">
          <h2 className="text-lg font-semibold">Challenge Player</h2>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Opponent wallet address (0x...)"
              value={opponentInput}
              onChange={(e) => setOpponentInput(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg bg-[#0a0a0f] border border-[#2a2a3a] px-4 py-2 text-sm"
            />
            <button
              onClick={handleChallenge}
              disabled={isLoading}
              className="rounded-lg bg-[var(--accent-purple)] px-4 py-2 font-semibold disabled:opacity-50"
            >
              Challenge Player
            </button>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Both players must have a saved deck. You cannot be in an active battle.
          </p>
        </div>
      )}

      {tab === "active" && (
        <>
          {!activeBattleId ? (
            <p className="text-[var(--text-secondary)]">
              No active battle. Challenge someone or wait for a challenge.
            </p>
          ) : !battle ? (
            <LoadingSpinner label="Loading battle..." />
          ) : battle.status === 2 ? (
            <div className="rounded-lg bg-[#12121a] p-6 text-center">
              <h2 className="text-xl font-semibold">Battle Over</h2>
              <p className="mt-2">
                Winner: {shorten(battle.winner)}
                {battle.winner?.toLowerCase() === address?.toLowerCase() && (
                  <span className="text-green-400 ml-2">(You!)</span>
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-6 rounded-lg bg-[#12121a] p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-[var(--text-secondary)] mb-1">
                    {isPlayerA ? "You" : "Opponent"} (Player A)
                  </p>
                  <HPBar current={Number(battle.hpA)} max={100} />
                  <div className="mt-2">
                    {cardForId(
                      battle.turnNumber != null
                        ? (battle.turnNumber % 5) + 1
                        : 1
                    )?.data && (
                      <CardDisplay
                        cardData={cardForId(
                          battle.turnNumber != null
                            ? (battle.turnNumber % 5) + 1
                            : 1
                        ).data}
                        ownedCount={1}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-[var(--text-secondary)] mb-1">
                    {isPlayerB ? "You" : "Opponent"} (Player B)
                  </p>
                  <HPBar current={Number(battle.hpB)} max={100} />
                </div>
              </div>

              <p className="text-center font-medium">
                Turn {Number(battle.turnNumber ?? 0) + 1} —{" "}
                {battle.currentTurn === 0 ? "Player A" : "Player B"}
                {isMyTurn && " (Your turn)"}
              </p>

              {isMyTurn && (
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={() => handlePlayMove(MOVE_ATTACK)}
                    disabled={isLoading}
                    className="rounded-lg bg-red-600 px-4 py-2 font-semibold disabled:opacity-50"
                  >
                    Attack
                  </button>
                  <button
                    onClick={() => handlePlayMove(MOVE_DEFEND)}
                    disabled={isLoading}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-semibold disabled:opacity-50"
                  >
                    Defend
                  </button>
                  <button
                    onClick={() => handlePlayMove(MOVE_SPECIAL)}
                    disabled={isLoading || specialUsed}
                    className="rounded-lg bg-amber-600 px-4 py-2 font-semibold disabled:opacity-50"
                  >
                    {specialUsed ? "Special (Used)" : "Special"}
                  </button>
                </div>
              )}

              <p className="text-sm text-center text-[var(--text-secondary)]">
                Turn timer: 5 min. If opponent doesn&apos;t move in time, you can claim a timeout win.
              </p>
              {!isMyTurn &&
                typeof deadline === "number" &&
                Math.floor(Date.now() / 1000) > deadline && (
                  <div className="text-center">
                    <button
                      onClick={handleTimeout}
                      className="rounded-lg bg-green-600 px-4 py-2 font-semibold"
                    >
                      Claim Timeout Win
                    </button>
                  </div>
                )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
