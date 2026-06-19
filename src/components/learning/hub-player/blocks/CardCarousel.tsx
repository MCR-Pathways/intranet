'use client';

import { useRef, useState } from 'react';
import type { ContentItemWithOptions, CardCarouselSettings } from '@/types/chat-content';
import { accent } from '@/lib/course/courseAccent';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';

/**
 * A horizontal, scroll-snap carousel of definition/term cards.
 * Ports the `DefinitionCarousel` block from the Safeguarding prototype.
 *
 * The scrollable track keeps the literal class `carousel-track`: the lesson
 * player uses that selector as a swipe-guard so horizontal drags scroll the
 * carousel instead of advancing the lesson.
 */
export function CardCarousel({ item }: { item: ContentItemWithOptions }) {
  const s = (item.settings ?? {}) as unknown as CardCarouselSettings;
  const cards = s.cards ?? [];

  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function onScroll() {
    const el = trackRef.current;
    // Guard against a zero width (hidden/not-yet-laid-out element), which would
    // make the division NaN/Infinity and set an invalid active index.
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) setActive(i);
  }

  function go(i: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  if (cards.length === 0) return null;

  return (
    <div className="-mx-5">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="carousel-track flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-5 py-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card, i) => {
          const a = accent(card.color);
          return (
            <article
              key={i}
              className="relative flex min-h-[230px] shrink-0 grow-0 basis-[calc(100%-40px)] snap-center flex-col gap-3 rounded-2xl border border-black/5 bg-white p-5 shadow-sm"
            >
              <span
                className={`grid h-12 w-12 place-items-center rounded-[14px] ${a.tintBg} ${a.deepText}`}
              >
                <CourseIcon name={card.icon} size={26} />
              </span>
              <h3 className="text-[1.22em] font-semibold leading-tight tracking-tight text-mcr-db-700">
                {card.term}
              </h3>
              <p className="flex-1 text-[0.97em] leading-relaxed text-mcr-db-400">{card.body}</p>
              <span className="text-xs font-semibold tabular-nums text-mcr-db-300">
                {i + 1} / {cards.length}
              </span>
            </article>
          );
        })}
      </div>
      <div className="mt-3.5 flex justify-center gap-[7px]">
        {cards.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to card ${i + 1}`}
            aria-current={i === active ? 'true' : undefined}
            onClick={() => go(i)}
            className="grid min-h-[44px] min-w-[44px] place-items-center"
          >
            <span
              className={
                i === active
                  ? 'block h-[7px] w-[22px] rounded-[5px] bg-mcr-darkblue transition-all duration-200'
                  : 'block h-[7px] w-[7px] rounded-full bg-mcr-db-200 transition-all duration-200'
              }
            />
          </button>
        ))}
      </div>
    </div>
  );
}
