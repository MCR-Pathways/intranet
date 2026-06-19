'use client';

import { useState } from 'react';
import type { ContentItem, FlashcardItemSettings } from '@/types/chat-content';

interface Card {
  front: string;
  back: string;
  hint?: string;
}

export function FlashcardItem({ item }: { item: ContentItem }) {
  const settings = (item.settings ?? {}) as FlashcardItemSettings;
  const cards = settings.cards ?? [];

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-mcr-db-100 bg-mcr-ivory p-4 text-sm text-mcr-db-400">
        No flashcards in this section.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {item.title ? (
        <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
      ) : null}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {cards.map((card, ci) => (
          <li key={ci}>
            <FlashcardFace card={card} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlashcardFace({ card }: { card: Card }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-pressed={flipped}
      className="w-full rounded-lg border border-mcr-db-100 bg-mcr-ivory p-3 text-left text-sm transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-mcr-pink focus:ring-offset-2"
    >
      {flipped ? (
        <div className="text-mcr-db-400">{card.back}</div>
      ) : (
        <>
          <div className="font-medium text-foreground">{card.front}</div>
          {card.hint ? (
            <div className="mt-2 text-xs italic text-mcr-db-300">Hint: {card.hint}</div>
          ) : null}
        </>
      )}
    </button>
  );
}
