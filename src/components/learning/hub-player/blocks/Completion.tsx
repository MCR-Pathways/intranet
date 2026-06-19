'use client';

import type { ContentItemWithOptions, CompletionSettings } from '@/types/chat-content';
import { accent } from '@/lib/course/courseAccent';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';

interface Props {
  item: ContentItemWithOptions;
  onRestart?: () => void;
}

/**
 * A celebratory end-of-course screen.
 *
 * Ports the `Completion` block from the Safeguarding prototype: a shield badge,
 * a heading (from `item.title`, falling back to "You're ready"), an optional
 * subtitle (from `item.content`), and a recap rendered as a column of cards.
 * Each recap card carries an accent-tinted badge chip and a label. A "Start
 * over" button invokes the supplied `onRestart` callback.
 */
export function Completion({ item, onRestart }: Props) {
  const s = (item.settings ?? {}) as unknown as CompletionSettings;
  const recap = s.recap ?? [];
  const heading = item.title ?? "You're ready";

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-mcr-darkblue text-mcr-ivory">
        <CourseIcon name="shield" size={34} />
      </div>

      <h2 className="text-[1.8em] font-semibold tracking-tight text-mcr-db-700">{heading}</h2>

      {item.content && (
        <p className="-mt-2.5 text-base leading-relaxed text-mcr-db-400">{item.content}</p>
      )}

      {recap.length > 0 && (
        <div className="flex flex-col gap-2">
          {recap.map((r, i) => {
            const a = accent(r.color);
            // Recap cards have no stable id (CompletionRecapItem is { badge?, label,
            // color? }), so we key by index.
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-black/5 bg-white px-3.5 py-3"
              >
                {r.badge && (
                  <span
                    className={`grid h-7 w-7 flex-none place-items-center rounded-full text-sm font-semibold text-white ${a.bg}`}
                  >
                    {r.badge}
                  </span>
                )}
                <strong className="text-[0.98em] font-semibold tracking-tight text-mcr-db-700">
                  {r.label}
                </strong>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onRestart}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-black/15 bg-transparent px-4 text-[0.9em] font-semibold text-mcr-db-400 transition-colors hover:bg-mcr-db-50"
      >
        <CourseIcon name="refresh" size={15} />
        Start over
      </button>
    </div>
  );
}
