'use client';

import { useState } from 'react';
import type { ContentItemWithOptions, InteractiveTilesSettings } from '@/types/chat-content';
import MarkdownRenderer from '@/components/learning/hub-player/MarkdownRenderer';
import { accent } from '@/lib/course/courseAccent';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';

/**
 * A 2-column grid of selectable tiles with a detail panel below.
 *
 * Ports the `FourRs` block from the Safeguarding prototype: each tile shows a
 * badge, label and icon; selecting a tile fills it with its accent colour
 * (white text) and reveals the tile's `short` summary and `body` underneath.
 * A "seen" set tracks visited tiles so they can be marked once revisited.
 */
export function InteractiveTiles({ item }: { item: ContentItemWithOptions }) {
  const s = (item.settings ?? {}) as unknown as InteractiveTilesSettings;
  const tiles = s.tiles ?? [];

  const [sel, setSel] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));

  const safeSel = sel < tiles.length ? sel : 0;

  if (tiles.length === 0) return null;

  const cur = tiles[safeSel];
  const curAccent = accent(cur.color);

  function pick(i: number) {
    setSel(i);
    setSeen((prev) => new Set(prev).add(i));
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((tile, i) => {
          const a = accent(tile.color);
          const on = i === safeSel;
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              aria-pressed={on}
              className={[
                'relative flex min-h-[44px] flex-col gap-1 rounded-xl border-[1.5px] p-3.5 pb-3 text-left transition-shadow hover:shadow-md',
                on
                  ? `${a.bg} ${a.border} text-white shadow-md`
                  : `border-black/10 bg-white ${a.tintBg}`,
              ].join(' ')}
            >
              {tile.badge && (
                <span
                  className={`text-[13px] font-semibold ${on ? 'text-white/80' : a.deepText}`}
                >
                  {tile.badge}
                </span>
              )}
              <span
                className={`text-[1.02em] font-semibold tracking-tight ${
                  on ? 'text-white' : 'text-mcr-db-700'
                }`}
              >
                {tile.label}
              </span>
              {tile.icon && (
                <span
                  className={`absolute right-3 top-3 ${on ? 'text-white/90' : a.deepText}`}
                >
                  <CourseIcon name={tile.icon} size={20} />
                </span>
              )}
              {seen.has(i) && !on && (
                <span
                  className={`absolute bottom-2.5 right-3 h-1.5 w-1.5 rounded-full ${a.bg}`}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        key={safeSel}
        className={`rounded-xl border border-l-4 border-black/5 bg-white p-4 motion-safe:animate-course-reveal ${curAccent.border}`}
      >
        <div className="mb-2 flex items-center gap-3">
          {cur.badge && (
            <span
              className={`flex h-7 w-7 flex-none place-items-center justify-center rounded-full text-sm font-semibold text-white ${curAccent.bg}`}
            >
              {cur.badge}
            </span>
          )}
          <div>
            <h3 className="text-[1.16em] font-semibold tracking-tight text-mcr-db-700">
              {cur.label}
            </h3>
            {cur.short && (
              <span className={`text-[0.82em] font-semibold ${curAccent.deepText}`}>
                {cur.short}
              </span>
            )}
          </div>
        </div>
        <div className="text-[0.97em] leading-relaxed text-mcr-db-400">
          <MarkdownRenderer content={cur.body} />
        </div>
      </div>
    </div>
  );
}
