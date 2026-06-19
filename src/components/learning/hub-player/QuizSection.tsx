'use client';

import { useState } from 'react';
import type { CourseSection } from '@/lib/course/courseSections';
import type { CourseAccent, SectionHeaderSettings } from '@/types/chat-content';
import { BlockRenderer } from '@/components/learning/hub-player/BlockRenderer';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';
import { accent } from '@/lib/course/courseAccent';

const GRADABLE = new Set(['multiple_choice', 'multi_select', 'yes_no', 'ordering']);

interface Props {
  section: CourseSection;
  /** advance the player past the quiz; also receives the final score */
  onComplete?: (score?: number) => void;
}

/**
 * Renders a quiz-layout section by delegating to {@link QuizStepper}, which runs
 * the gated one-at-a-time learner stepper.
 */
export function QuizSection({ section, onComplete }: Props) {
  // Only gradable blocks are quiz questions; this keeps the "Question N of M"
  // counter and the score denominator in sync (non-question blocks belong in the
  // section masthead/lede, not the quiz stepper).
  const questions = section.blocks.filter((q) => GRADABLE.has(q.type));

  return <QuizStepper section={section} questions={questions} onComplete={onComplete} />;
}

/** The gated one-at-a-time learner stepper. Its mount lifecycle owns the run. */
function QuizStepper({
  section,
  questions,
  onComplete,
}: {
  section: CourseSection;
  questions: CourseSection['blocks'];
  onComplete?: (score?: number) => void;
}) {
  const total = questions.length;
  const accentName = (section.header.settings as SectionHeaderSettings)?.accent as
    | CourseAccent
    | undefined;
  const a = accent(accentName);

  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const current = questions[idx];
  const isGradable = current ? GRADABLE.has(current.type) : false;
  const isLast = idx >= questions.length - 1;

  function handleAnswered(correct: boolean) {
    setAnswered(true);
    if (correct) setScore((s) => s + 1);
  }

  function next() {
    if (isLast) {
      setDone(true);
      return;
    }
    setIdx((i) => i + 1);
    setAnswered(false);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-full ${a.tintBg} ${a.deepText}`}
        >
          <span className="text-3xl font-semibold tabular-nums">
            {score}/{total}
          </span>
        </div>
        <h3 className="text-xl font-semibold text-mcr-db-500">
          You scored {score} out of {total}
        </h3>
        <p className="text-mcr-db-400">
          {score === total
            ? 'Perfect — you clearly know your safeguarding basics.'
            : 'Review anything you were unsure about, then carry on.'}
        </p>
        {onComplete && (
          <button
            type="button"
            onClick={() => onComplete(score)}
            className="mt-2 flex h-11 items-center gap-1.5 rounded-full bg-mcr-darkblue px-6 text-sm font-semibold text-white"
          >
            Continue
            <CourseIcon name="arrowR" size={18} />
          </button>
        )}
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wider ${a.deepText}`}>
          Question {idx + 1} of {questions.length}
        </span>
      </div>

      {/* key by item id so each question mounts fresh (no carried-over answer state) */}
      <BlockRenderer key={current.id} item={current} onAnswered={handleAnswered} />

      <button
        type="button"
        onClick={next}
        disabled={isGradable && !answered}
        className="flex h-11 items-center justify-center gap-1.5 self-end rounded-full bg-mcr-darkblue px-6 text-sm font-semibold text-white disabled:opacity-40"
      >
        {isLast ? 'See results' : 'Next question'}
        <CourseIcon name="arrowR" size={18} />
      </button>
    </div>
  );
}
