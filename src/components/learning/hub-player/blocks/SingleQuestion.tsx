'use client';

import { useState } from 'react';
import type { ContentItemWithOptions, QuizItemSettings } from '@/types/chat-content';
import { scoreSingle } from '@/lib/course/courseQuiz';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';

/** Visual state for a single option once the question is locked. */
type OptState = 'idle' | 'correct' | 'wrong' | 'dim';

/**
 * A single-answer multiple-choice question. Renders the prompt and one button
 * per option. The first pick locks the whole set: the chosen option is marked
 * correct (green) or wrong (wine), the correct option is always revealed, the
 * rest are dimmed, and the explanation appears. `onAnswered` fires exactly once
 * with the scored boolean.
 *
 * Ports `SingleQuestion` from the Safeguarding prototype (course-quiz.jsx),
 * re-expressing the `.opt`/`.quiz-fb` CSS as Tailwind + MCR tokens.
 */
export function SingleQuestion({
  item,
  onAnswered,
}: {
  item: ContentItemWithOptions;
  onAnswered?: (correct: boolean) => void;
}) {
  const correctValue = (item.correct_answer as { value?: string } | null)?.value ?? '';
  const explanation = (item.settings as QuizItemSettings | null)?.explanation;
  const question = item.content ?? item.title ?? '';

  const [chosen, setChosen] = useState<string | null>(null);

  const locked = chosen !== null;
  const isRight = locked && scoreSingle(chosen, correctValue);

  function pick(value: string) {
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

      <div className="flex flex-col gap-2.5">
        {item.options.map((o) => {
          let state: OptState = 'idle';
          if (locked) {
            if (o.value === correctValue) state = 'correct';
            else if (o.value === chosen) state = 'wrong';
            else state = 'dim';
          }

          const surface =
            state === 'correct'
              ? 'border-mcr-green bg-mcr-gn-50'
              : state === 'wrong'
                ? 'border-mcr-wine bg-mcr-wn-50'
                : 'border-black/10 bg-white';
          const box =
            state === 'correct'
              ? 'border-transparent bg-mcr-green text-white'
              : state === 'wrong'
                ? 'border-mcr-wine bg-mcr-wine text-white'
                : 'border-mcr-db-200 bg-transparent text-transparent';

          return (
            <button
              key={o.id}
              type="button"
              disabled={locked}
              onClick={() => pick(o.value)}
              className={`flex min-h-[44px] items-center gap-3 rounded-xl border-[1.5px] px-4 py-3 text-left transition-all ${surface} ${
                state === 'dim' ? 'opacity-50' : ''
              } ${locked ? 'cursor-default' : 'hover:border-mcr-db-300 hover:bg-mcr-db-50'}`}
            >
              <span
                className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-full border-[1.5px] transition-all ${box}`}
              >
                {state === 'correct' && <CourseIcon name="check" size={14} />}
                {state === 'wrong' && <CourseIcon name="x" size={14} />}
              </span>
              <span className="text-[0.96em] leading-snug text-mcr-db-700">{o.label}</span>
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
