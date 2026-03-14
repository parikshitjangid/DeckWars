import React from "react";
import { useQuest } from "../hooks/useQuest";
import { useCards } from "../hooks/useCards";
import QuestCard from "../components/QuestCard";
import CardDisplay from "../components/CardDisplay";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAccount } from "wagmi";

const CARD_IDS = Array.from({ length: 20 }, (_, i) => i + 1);

export default function QuestsPage() {
  const { address } = useAccount();
  const { quests, claim, vote, checkCollector, isLoading } = useQuest();
  const { cards } = useCards();

  const cardData = (id) => cards.find((c) => c.id === id)?.data;
  const isCollectorQuest = (id) => id === 2;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Quests</h1>

      <section>
        <h2 className="text-lg font-semibold mb-4">Quest Progress</h2>
        {quests.length === 0 ? (
          <LoadingSpinner label="Loading quests..." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quests.map((q) => (
              <QuestCard
                key={q.id}
                name={q.name}
                description={q.description}
                goal={q.goal}
                progress={q.progress}
                rewardCardId={q.rewardCardId}
                claimed={q.claimed}
                onClaim={() => claim(q.id)}
                onCheckCollector={checkCollector}
                isCollector={isCollectorQuest(q.id)}
                isLoading={isLoading}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg bg-[#12121a] p-6">
        <h2 className="text-lg font-semibold mb-4">
          Vote for Season 2&apos;s Featured Card
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {CARD_IDS.map((id) => (
            <div key={id} className="relative">
              <CardDisplay
                cardId={id}
                cardData={cardData(id)}
                ownedCount={cards.find((c) => c.id === id)?.balance ?? 0}
              />
              <button
                onClick={() => vote(id)}
                disabled={isLoading}
                className="mt-2 w-full rounded bg-[#1a1a2e] py-1 text-xs font-medium disabled:opacity-50"
              >
                Vote
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
