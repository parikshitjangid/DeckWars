import React, { useMemo, useState } from "react";
import { useCards } from "../hooks/useCards";
import { useDeck } from "../hooks/useDeck";
import CardDisplay from "../components/CardDisplay";
import LoadingSpinner from "../components/LoadingSpinner";
import toast from "react-hot-toast";

const DECK_SIZE = 20;

export default function DeckBuilder() {
  const { cards, isLoading: cardsLoading } = useCards();
  const { deck, hasDeck, isLocked, registerDeck, isLoading: deckLoading } = useDeck();
  const [selected, setSelected] = useState([]);

  const ownedCards = useMemo(
    () => cards.filter((c) => c.balance > 0),
    [cards]
  );

  const canAdd = (cardId) =>
    selected.length < DECK_SIZE && !selected.includes(cardId);

  const addToDeck = (cardId) => {
    if (!canAdd(cardId)) return;
    setSelected((s) => [...s, cardId]);
  };

  const removeFromDeck = (index) => {
    setSelected((s) => s.filter((_, i) => i !== index));
  };

  const currentDeckIds = useMemo(() => {
    if (selected.length === DECK_SIZE) return selected;
    const fromSaved = deck.filter((id) => id > 0);
    if (fromSaved.length === DECK_SIZE) return fromSaved;
    const filled = [...selected];
    while (filled.length < DECK_SIZE && fromSaved.length > 0) {
      const next = fromSaved[filled.length];
      if (next) filled.push(next);
      else break;
    }
    return filled;
  }, [selected, deck]);

  const deckToSave = selected.length === DECK_SIZE ? selected : currentDeckIds;
  const isValid = deckToSave.length === DECK_SIZE;

  const handleSave = async () => {
    if (!isValid) {
      toast.error("Deck must have exactly 20 cards.");
      return;
    }
    await registerDeck(deckToSave);
  };

  if (cardsLoading) {
    return (
      <div className="py-8">
        <LoadingSpinner label="Loading cards..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Deck Builder</h1>
      {isLocked && (
        <p className="rounded-lg bg-amber-900/30 text-amber-200 px-4 py-2 text-sm">
          Deck locked (in battle). Finish or forfeit the battle to edit.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-semibold mb-3">My Collection</h2>
          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin rounded-lg bg-[#12121a] p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ownedCards.map((card) => (
                <CardDisplay
                  key={card.id}
                  cardId={card.id}
                  cardData={card.data}
                  ownedCount={card.balance}
                  onClick={() => addToDeck(card.id)}
                  selected={selected.includes(card.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">
            Current Deck ({deckToSave.length} / {DECK_SIZE})
          </h2>
          {deckToSave.length !== DECK_SIZE && (
            <p className="text-red-400 text-sm mb-2">
              Add cards until you have exactly 20.
            </p>
          )}
          <div className="min-h-[200px] rounded-lg bg-[#12121a] p-4 border border-[#2a2a3a]">
            <div className="flex flex-wrap gap-2 mb-4">
              {(selected.length === DECK_SIZE ? selected : deckToSave).map(
                (id, idx) => {
                  const card = cards.find((c) => c.id === id);
                  return (
                    <div key={`${id}-${idx}`} className="relative">
                      <CardDisplay
                        cardId={id}
                        cardData={card?.data}
                        ownedCount={card?.balance ?? 0}
                        onClick={() =>
                          selected.length === DECK_SIZE
                            ? removeFromDeck(idx)
                            : null
                        }
                      />
                      {selected.length === DECK_SIZE && (
                        <button
                          type="button"
                          onClick={() => removeFromDeck(idx)}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                }
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={!isValid || isLocked || deckLoading}
              className="w-full rounded-lg bg-[var(--accent-purple)] py-2 font-semibold disabled:opacity-50"
            >
              {deckLoading ? "Saving..." : "Save Deck Onchain"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
