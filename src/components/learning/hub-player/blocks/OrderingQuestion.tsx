'use client';

import { useRef, useState } from 'react';
import type { ContentItemWithOptions, OrderingSettings, QuizItemSettings } from '@/types/chat-content';
import { scoreOrdering } from '@/lib/course/courseQuiz';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';

/**
 * A drag/arrow ordering question. The correct sequence is the settings `items`
 * array order; we present a DETERMINISTIC initial order (the correct array
 * reversed) so the list is never already solved for length >= 2 and so tests are
 * stable. Learners reorder rows with the accessible Up/Down arrow buttons
 * (pointer drag on the grip is an optional enhancement). Pressing "Check answer"
 * grades the current order against the key via `scoreOrdering`, locks the list,
 * colours each row right/wrong, reveals the explanation, and fires `onAnswered`
 * exactly once.
 *
 * Ports `OrderQuestion` from the Safeguarding prototype (course-quiz.jsx),
 * re-expressing the `.ord-list`/`.ord-row`/`.q-check`/`.quiz-fb` CSS as Tailwind
 * + MCR tokens. The list container keeps the literal `ord-list` class because the
 * player uses it as a swipe-guard selector.
 */
export function OrderingQuestion({
  item,
  onAnswered,
}: {
  item: ContentItemWithOptions;
  onAnswered?: (correct: boolean) => void;
}) {
  const correct = (item.settings as unknown as OrderingSettings | null)?.items ?? [];
  const explanation = (item.settings as QuizItemSettings | null)?.explanation;
  const question = item.content ?? item.title ?? '';

  // Each entry carries its correct index so grading is independent of label text.
  const [order, setOrder] = useState<Array<{ text: string; i: number }>>(() =>
    correct.map((text, i) => ({ text, i })).reverse(),
  );
  const [checked, setChecked] = useState(false);
  const isRight = checked && scoreOrdering(order.map((o) => o.text), correct);

  // Optional pointer-drag enhancement (arrows are the primary, accessible path).
  const dragIndex = useRef<number | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  function move(idx: number, dir: -1 | 1) {
    if (checked) return;
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    setOrder((prev) => {
      const next = prev.slice();
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  function onDown(e: React.PointerEvent, i: number) {
    if (checked) return;
    dragIndex.current = i;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (dragIndex.current === null) return;
    const y = e.clientY;
    let target = dragIndex.current;
    for (let k = 0; k < rowRefs.current.length; k++) {
      const el = rowRefs.current[k];
      if (!el) continue;
      const rc = el.getBoundingClientRect();
      if (y >= rc.top && y <= rc.bottom) {
        target = k;
        break;
      }
    }
    if (target !== dragIndex.current) {
      const from = dragIndex.current;
      setOrder((prev) => {
        const next = prev.slice();
        const [moved] = next.splice(from, 1);
        next.splice(target, 0, moved);
        return next;
      });
      dragIndex.current = target;
    }
  }
  function onUp() {
    dragIndex.current = null;
  }

  function check() {
    if (checked) return;
    setChecked(true);
    onAnswered?.(scoreOrdering(order.map((o) => o.text), correct));
  }

  return (
    <div className="flex flex-col gap-3">
      {question && (
        <h3 className="text-[1.15em] font-semibold leading-snug tracking-tight text-mcr-db-700">
          {question}
        </h3>
      )}

      <div className="ord-list flex flex-col gap-2">
        {order.map((row, idx) => {
          const rowState = checked ? (row.i === idx ? 'ok' : 'bad') : 'idle';
          const surface =
            rowState === 'ok'
              ? 'border-mcr-green bg-mcr-gn-50'
              : rowState === 'bad'
                ? 'border-mcr-wine bg-mcr-wn-50'
                : 'border-black/10 bg-white';

          return (
            <div
              key={row.i}
              ref={(el) => {
                rowRefs.current[idx] = el;
              }}
              className={`flex items-center gap-3 rounded-xl border-[1.5px] px-3 py-3 transition-all ${surface}`}
            >
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-mcr-db-50 text-[13px] font-semibold text-mcr-db-400">
                {idx + 1}
              </span>
              <span className="flex-1 text-[0.98em] font-semibold leading-snug text-mcr-db-700">
                {row.text}
              </span>

              {!checked && (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={idx === 0}
                    onClick={() => move(idx, -1)}
                    className="grid min-h-[44px] min-w-[44px] place-items-center rounded-md text-mcr-db-300 transition-all hover:bg-mcr-db-50 hover:text-mcr-db-700 disabled:cursor-default disabled:opacity-30"
                  >
                    <span className="flex -rotate-90">
                      <CourseIcon name="chevR" size={16} />
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={idx === order.length - 1}
                    onClick={() => move(idx, 1)}
                    className="grid min-h-[44px] min-w-[44px] place-items-center rounded-md text-mcr-db-300 transition-all hover:bg-mcr-db-50 hover:text-mcr-db-700 disabled:cursor-default disabled:opacity-30"
                  >
                    <span className="flex rotate-90">
                      <CourseIcon name="chevR" size={16} />
                    </span>
                  </button>
                  {/* Decorative pointer-drag grip: the Up/Down buttons above are
                      the accessible reorder path, so this element is aria-hidden
                      and intentionally has no keyboard handler. */}
                  <span
                    aria-hidden="true"
                    onPointerDown={(e) => onDown(e, idx)}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    className="grid min-h-[44px] min-w-[44px] cursor-grab touch-none place-items-center text-mcr-db-200 active:cursor-grabbing"
                  >
                    <CourseIcon name="grip" size={18} />
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!checked && (
        <button
          type="button"
          onClick={check}
          className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-lg bg-mcr-darkblue px-5 py-3 text-[0.94em] font-semibold text-white transition-all hover:brightness-110"
        >
          Check answer
        </button>
      )}

      {checked && explanation && (
        <div className={`flex gap-3 rounded-xl p-3.5 ${isRight ? 'bg-mcr-gn-50' : 'bg-mcr-wn-50'}`}>
          <span
            className={`grid h-[26px] w-[26px] flex-none place-items-center rounded-full text-white ${
              isRight ? 'bg-mcr-green' : 'bg-mcr-wine'
            }`}
          >
            <CourseIcon name={isRight ? 'check' : 'x'} size={16} />
          </span>
          <div className="flex flex-col gap-0.5">
            <strong
              className={`text-[0.92em] font-semibold ${
                isRight ? 'text-mcr-gn-700' : 'text-mcr-wine'
              }`}
            >
              {isRight ? 'Correct' : 'Not quite'}
            </strong>
            <p className="text-[0.9em] leading-relaxed text-mcr-db-400">{explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
