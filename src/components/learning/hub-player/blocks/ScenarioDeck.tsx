'use client';

import { useEffect, useRef, useState } from 'react';
import type { ContentItemWithOptions, ScenarioDeckSettings, ScenarioEntry } from '@/types/chat-content';
import { accent } from '@/lib/course/courseAccent';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';

/**
 * A single flip card for one scenario. FRONT poses the scenario + a Yes/No
 * choice on a deep brand surface; picking an answer flips (rotateY) to the
 * BACK, which shows the verdict + explanation for the picked answer with a
 * green (correct) or wine (incorrect) correctness treatment and a reset.
 *
 * Ports `ScenarioCard` from the Safeguarding prototype (course-ui.jsx).
 */
function ScenarioCard({ data }: { data: ScenarioEntry }) {
  const [picked, setPicked] = useState<'yes' | 'no' | null>(null);
  const [flipped, setFlipped] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  function pick(ans: 'yes' | 'no') {
    if (picked) return;
    setPicked(ans);
    timers.current.push(window.setTimeout(() => setFlipped(true), 80));
  }

  function reset() {
    setFlipped(false);
    timers.current.push(window.setTimeout(() => setPicked(null), 380));
  }

  const r = picked ? data.responses?.[picked] ?? null : null;
  const isRight = picked === data.correct;

  return (
    <div className="[perspective:1600px]">
      {/* scn-stage: the lesson player uses this selector as a swipe-guard. */}
      <div className="scn-stage relative min-h-[430px]">
        <div
          className={`relative min-h-[430px] w-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          {/* front */}
          <div className="absolute inset-0 flex flex-col overflow-auto rounded-2xl bg-mcr-darkblue p-[22px_22px_20px] text-mcr-ivory shadow-lg [backface-visibility:hidden]">
            <div className="mb-4 flex items-center justify-between gap-3">
              {data.tag && (
                <span className="self-start rounded-full border border-mcr-ivory/20 bg-mcr-ivory/[0.14] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-mcr-ivory">
                  {data.tag}
                </span>
              )}
              {data.name && (
                <span className="text-[0.95em] font-semibold text-mcr-ivory/85">
                  {data.name}
                </span>
              )}
            </div>
            <p className="flex-1 text-[1.06em] leading-snug text-mcr-ivory">{data.scenario}</p>
            <p className="my-4 text-[0.95em] font-semibold text-mcr-ivory/[0.82]">{data.prompt}</p>
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={!!picked}
                onClick={() => pick('no')}
                className={`min-h-[44px] flex-1 rounded-lg border-[1.5px] py-3.5 text-base font-semibold transition-all ${
                  picked === 'no'
                    ? 'border-mcr-ivory bg-mcr-ivory text-mcr-darkblue'
                    : `border-mcr-ivory/35 bg-transparent text-mcr-ivory hover:bg-mcr-ivory/10 ${
                        picked ? 'opacity-40' : ''
                      }`
                }`}
              >
                No
              </button>
              <button
                type="button"
                disabled={!!picked}
                onClick={() => pick('yes')}
                className={`min-h-[44px] flex-1 rounded-lg border-[1.5px] py-3.5 text-base font-semibold transition-all ${
                  picked === 'yes'
                    ? 'border-mcr-ivory bg-mcr-ivory text-mcr-darkblue'
                    : `border-mcr-ivory/35 bg-transparent text-mcr-ivory hover:bg-mcr-ivory/10 ${
                        picked ? 'opacity-40' : ''
                      }`
                }`}
              >
                Yes
              </button>
            </div>
          </div>

          {/* back */}
          <div className="absolute inset-0 flex flex-col overflow-auto rounded-2xl border border-black/5 bg-white p-[22px_22px_20px] text-mcr-db-700 shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span
              className={`absolute inset-x-0 top-0 h-[5px] rounded-t-2xl ${
                isRight ? 'bg-mcr-green' : 'bg-mcr-wine'
              }`}
            />
            {picked && r && (
              <>
                <div className="mb-3 mt-1.5 flex items-center gap-3">
                  <span
                    className={`grid h-11 w-11 flex-none place-items-center rounded-full ${
                      isRight ? 'bg-mcr-gn-50 text-mcr-gn-700' : 'bg-mcr-wn-50 text-mcr-wine'
                    }`}
                  >
                    <CourseIcon name={isRight ? 'check' : 'x'} size={24} />
                  </span>
                  <h3 className="text-[1.3em] font-semibold tracking-tight text-mcr-db-700">
                    {r.verdict}
                  </h3>
                </div>
                <p className="flex-1 text-[0.98em] leading-relaxed text-mcr-db-400">{r.explain}</p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-[7px] self-start rounded-lg border border-black/10 px-3.5 py-2 text-[0.86em] font-semibold text-mcr-db-400 transition-colors hover:bg-mcr-db-50"
                >
                  <CourseIcon name="refresh" size={15} />
                  Try a different answer
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A deck that shows one decision scenario at a time with prev/next controls
 * and dot navigation. Changing scenario remounts the card (via `key`) so the
 * flip + picked answer reset cleanly.
 *
 * Ports `ScenarioDeck` from the Safeguarding prototype (course-sections.jsx).
 */
export function ScenarioDeck({ item }: { item: ContentItemWithOptions }) {
  const s = (item.settings ?? {}) as unknown as ScenarioDeckSettings;
  const scenarios = s.scenarios ?? [];
  const a = accent(s.accent);

  const [idx, setIdx] = useState(0);

  // Learner path: nothing to play with no scenarios.
  if (scenarios.length === 0) return null;

  const safeIdx = Math.min(idx, scenarios.length - 1);
  const isLast = safeIdx === scenarios.length - 1;

  return (
    <div className="flex flex-col gap-4">
      <ScenarioCard key={safeIdx} data={scenarios[safeIdx]} />
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          disabled={safeIdx === 0}
          onClick={() => setIdx(safeIdx - 1)}
          aria-label="Previous scenario"
          className="grid h-11 min-h-[44px] w-11 min-w-[44px] flex-none place-items-center rounded-lg border border-black/10 bg-white text-mcr-db-700 transition-colors hover:bg-mcr-db-50 disabled:cursor-default disabled:opacity-35"
        >
          <span className="flex -scale-x-100">
            <CourseIcon name="arrowR" size={18} />
          </span>
        </button>
        <div className="flex flex-1 justify-center gap-[7px]">
          {scenarios.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Scenario ${i + 1}`}
              aria-current={i === safeIdx ? 'true' : undefined}
              onClick={() => setIdx(i)}
              className="grid min-h-[44px] min-w-[44px] place-items-center"
            >
              <span
                className={
                  i === safeIdx
                    ? `block h-2 w-[22px] rounded-[5px] transition-all duration-200 ${a.bg}`
                    : 'block h-2 w-2 rounded-full bg-mcr-db-200 transition-all duration-200'
                }
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={isLast}
          onClick={() => setIdx(safeIdx + 1)}
          aria-label="Next scenario"
          className="grid h-11 min-h-[44px] w-11 min-w-[44px] flex-none place-items-center rounded-lg border border-black/10 bg-white text-mcr-db-700 transition-colors hover:bg-mcr-db-50 disabled:cursor-default disabled:opacity-35"
        >
          <CourseIcon name="arrowR" size={18} />
        </button>
      </div>
    </div>
  );
}
