'use client';

import { useState } from 'react';
import type { ContentItemWithOptions, QuizItemSettings } from '@/types/chat-content';
import { scoreSingle } from '@/lib/course/courseQuiz';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';

/** The two fixed answers for a yes/no question. */
type YesNo = 'yes' | 'no';

const CHOICES: Array<{ value: YesNo; label: string }> = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
];

/**
 * A yes/no judgement question. Unlike {@link SingleQuestion} there are no option
 * rows in the content — the answers are the fixed values `'yes'` and `'no'`, and
 * the key is `(item.correct_answer as { value }).value`. The first pick locks the
 * pair: the chosen answer is marked correct (green) or wrong (wine), the
 * explanation appears, and `onAnswered` fires exactly once with the scored
 * boolean.
 *
 * Ports the yes/no variant of `SingleQuestion` plus the scenario Yes/No button
 * styling from the Safeguarding prototype (course-quiz.jsx / course-ui.jsx),
 * re-expressing the `.scn-btn`/`.quiz-fb` CSS as Tailwind + MCR tokens.
 */
export function YesNoQuestion({
  item,
  onAnswered,
}: {
  item: ContentItemWithOptions;
  onAnswered?: (correct: boolean) => void;
}) {
  const correctValue = (item.correct_answer as { value?: YesNo } | null)?.value ?? '';
  const explanation = (item.settings as QuizItemSettings | null)?.explanation;
  const question = item.content ?? item.title ?? '';

  const [chosen, setChosen] = useState<YesNo | null>(null);

  const locked = chosen !== null;
  const isRight = locked && scoreSingle(chosen, correctValue);

  function pick(value: YesNo) {
    if (locked) return;
    setChosen(value);
    onAnswered?.(scoreSingle(value, correctValue));
  }

  return (
    <div className="flex flex-col gap-3">
      {question && (
        <h3 className="text-[1.15em] font-semibold leading-snug tracking-tight text-mcr-db-700">
          {question}
        </h3>
      )}

      <div className="flex gap-2.5">
        {CHOICES.map((c) => {
          const picked = chosen === c.value;
          let surface = 'border-mcr-db-200 bg-white text-mcr-db-700';
          if (locked) {
            if (picked) {
              surface = isRight
                ? 'border-mcr-green bg-mcr-gn-50 text-mcr-gn-700'
                : 'border-mcr-wine bg-mcr-wn-50 text-mcr-wine';
            } else {
              surface = 'border-mcr-db-200 bg-white text-mcr-db-700 opacity-50';
            }
          }

          return (
            <button
              key={c.value}
              type="button"
              disabled={locked}
              onClick={() => pick(c.value)}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] px-4 py-3 text-[0.96em] font-semibold transition-all ${surface} ${
                locked ? 'cursor-default' : 'hover:border-mcr-db-300 hover:bg-mcr-db-50'
              }`}
            >
              {picked && (
                <CourseIcon name={isRight ? 'check' : 'x'} size={16} />
              )}
              {c.label}
            </button>
          );
        })}
      </div>

      {locked && explanation && (
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
