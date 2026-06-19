'use client';

import { useState } from 'react';
import type { ContentItemWithOptions, QuizItemSettings } from '@/types/chat-content';
import { scoreMulti } from '@/lib/course/courseQuiz';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';

/** Visual state for a single option once the question is checked. */
type OptState = 'idle' | 'chosen' | 'correct' | 'missed' | 'wrong' | 'dim';

/**
 * A multi-answer (select-all) question. Renders the prompt and one toggle
 * checkbox per option. Picks accumulate until the learner presses "Check
 * answer" (disabled until at least one is selected). Checking locks the set and
 * grades it all-or-nothing via `scoreMulti`: chosen-and-correct options go green
 * (correct), correct-but-unchosen go dashed-green (missed), chosen-but-incorrect
 * go wine (wrong), the rest dim. The explanation then appears and `onAnswered`
 * fires exactly once with the scored boolean.
 *
 * Ports `MultiQuestion` from the Safeguarding prototype (course-quiz.jsx),
 * re-expressing the `.opt`/`.q-check`/`.quiz-fb` CSS as Tailwind + MCR tokens.
 */
export function MultiQuestion({
  item,
  onAnswered,
}: {
  item: ContentItemWithOptions;
  onAnswered?: (correct: boolean) => void;
}) {
  const correctValues = (item.correct_answer as { values?: string[] } | null)?.values ?? [];
  const explanation = (item.settings as QuizItemSettings | null)?.explanation;
  const question = item.content ?? item.title ?? '';

  const [selected, setSelected] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const isRight = checked && scoreMulti(selected, correctValues);
  const correctSet = new Set(correctValues);

  function toggle(value: string) {
    if (checked) return;
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function check() {
    if (checked || selected.length === 0) return;
    setChecked(true);
    onAnswered?.(scoreMulti(selected, correctValues));
  }

  return (
    <div className="flex flex-col gap-3">
      {question && (
        <h3 className="text-[1.15em] font-semibold leading-snug tracking-tight text-mcr-db-700">
          {question}
        </h3>
      )}

      <div className="flex flex-col gap-2.5">
        {item.options.map((o) => {
          const isSelected = selected.includes(o.value);
          let state: OptState = isSelected ? 'chosen' : 'idle';
          if (checked) {
            if (correctSet.has(o.value) && isSelected) state = 'correct';
            else if (correctSet.has(o.value) && !isSelected) state = 'missed';
            else if (!correctSet.has(o.value) && isSelected) state = 'wrong';
            else state = 'dim';
          }

          const surface =
            state === 'correct'
              ? 'border-mcr-green bg-mcr-gn-50'
              : state === 'missed'
                ? 'border-mcr-green border-dashed bg-white'
                : state === 'wrong'
                  ? 'border-mcr-wine bg-mcr-wn-50'
                  : state === 'chosen'
                    ? 'border-mcr-darkblue bg-mcr-db-50'
                    : 'border-black/10 bg-white';
          const box =
            state === 'correct' || state === 'missed'
              ? 'border-transparent bg-mcr-green text-white'
              : state === 'wrong'
                ? 'border-mcr-wine bg-mcr-wine text-white'
                : state === 'chosen'
                  ? 'border-mcr-darkblue bg-mcr-darkblue text-white'
                  : 'border-mcr-db-200 bg-transparent text-transparent';

          return (
            <button
              key={o.id}
              type="button"
              disabled={checked}
              aria-pressed={isSelected}
              onClick={() => toggle(o.value)}
              className={`flex min-h-[44px] items-center gap-3 rounded-xl border-[1.5px] px-4 py-3 text-left transition-all ${surface} ${
                state === 'dim' ? 'opacity-50' : ''
              } ${checked ? 'cursor-default' : 'hover:border-mcr-db-300 hover:bg-mcr-db-50'}`}
            >
              <span
                className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-md border-[1.5px] transition-all ${box}`}
              >
                {(state === 'chosen' || state === 'correct' || state === 'missed') && (
                  <CourseIcon name="check" size={14} />
                )}
                {state === 'wrong' && <CourseIcon name="x" size={14} />}
              </span>
              <span className="text-[0.96em] leading-snug text-mcr-db-700">{o.label}</span>
            </button>
          );
        })}
      </div>

      {!checked && (
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={check}
          className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-lg bg-mcr-darkblue px-5 py-3 text-[0.94em] font-semibold text-white transition-all hover:brightness-110 disabled:cursor-default disabled:opacity-40"
        >
          Check answer
        </button>
      )}

      {checked && explanation && (
        <div
          className={`flex gap-3 rounded-xl p-3.5 ${
            isRight ? 'bg-mcr-gn-50' : 'bg-mcr-wn-50'
          }`}
        >
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
