'use client';

import { useState } from 'react';
import type { ContentItemWithOptions, AccordionSettings } from '@/types/chat-content';
import { accent } from '@/lib/course/courseAccent';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';

/**
 * A single-open accordion of expandable rows (ports the prototype `AbuseCards`).
 * Each row reveals a body and an optional "Signs to notice" chip list when open;
 * opening one row collapses any other. The scrollable list carries the
 * `abuse-list` class so the player's swipe-guard can target it.
 */
export function Accordion({ item }: { item: ContentItemWithOptions }) {
  const s = (item.settings ?? {}) as unknown as AccordionSettings;
  const entries = s.items ?? [];
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="abuse-list flex flex-col gap-2">
      {entries.map((entry, i) => {
        const a = accent(entry.color);
        const isOpen = open === i;
        // Filter blank signs so an empty added-but-unfilled chip never renders to
        // learners as an empty pill (FIX E).
        const visibleSigns = (entry.signs ?? []).filter((sign) => sign.trim() !== '');
        return (
          <div
            key={i}
            className={`overflow-hidden rounded-xl border border-black/5 bg-white transition-shadow ${
              isOpen ? 'shadow-lg' : ''
            }`}
          >
            <button
              type="button"
              id={`acc-ctrl-${item.id}-${i}`}
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-controls={`acc-panel-${item.id}-${i}`}
              className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span
                className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${a.tintBg} ${a.deepText}`}
              >
                <CourseIcon name={entry.icon ?? 'shield'} size={18} />
              </span>
              <span className="flex-1 text-[0.98em] font-semibold tracking-tight text-mcr-db-700">
                {entry.title}
              </span>
              <span
                className={`inline-flex flex-none text-mcr-db-300 transition-transform duration-200 ${
                  isOpen ? 'rotate-90' : ''
                }`}
              >
                <CourseIcon name="chevR" size={18} />
              </span>
            </button>
            {isOpen && (
              <div
                id={`acc-panel-${item.id}-${i}`}
                role="region"
                aria-labelledby={`acc-ctrl-${item.id}-${i}`}
                className="animate-course-reveal px-4 pb-4 pl-[59px] motion-reduce:animate-none"
              >
                <p className="mb-3 text-[0.94em] leading-relaxed text-mcr-db-400">{entry.body}</p>
                {visibleSigns.length > 0 && (
                  <>
                    <span className="mb-2 block text-[0.72em] font-semibold uppercase tracking-[0.06em] text-mcr-db-300">
                      Signs to notice
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {visibleSigns.map((sign, j) => (
                        <span
                          key={j}
                          className={`rounded-full px-2.5 py-1 text-[0.82em] font-medium ${a.tintBg} ${a.deepText}`}
                        >
                          {sign}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
