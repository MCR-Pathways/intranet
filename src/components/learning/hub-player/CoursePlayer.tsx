'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  LoadedContent,
  SectionHeaderSettings,
  CourseAccent,
} from '@/types/chat-content';
import { groupIntoSections, type CourseSection } from '@/lib/course/courseSections';
import { accent } from '@/lib/course/courseAccent';
import { CourseChrome, COURSE_COLUMN } from '@/components/learning/hub-player/CourseChrome';
import { BlockRenderer } from '@/components/learning/hub-player/BlockRenderer';
import { QuizSection } from '@/components/learning/hub-player/QuizSection';

// Horizontal scrollers a section-changing swipe must NOT trigger inside.
const SWIPE_GUARD = '.carousel-track, .ord-list, .scn-stage, .abuse-list';

function readInitial(key: string, total: number): number {
  try {
    const v = parseInt(localStorage.getItem(key) ?? '0', 10);
    return Number.isFinite(v) && v >= 0 && v < total ? v : 0;
  } catch {
    return 0;
  }
}

/**
 * Read-only section masthead: a numbered chip, an optional kicker, the section
 * title and an optional intro paragraph. Rendered by the player above each
 * non-completion section's block stack.
 */
export function Masthead({
  index,
  section,
}: {
  index: number;
  section: CourseSection;
}) {
  const s = (section.header.settings ?? {}) as SectionHeaderSettings;
  const a = accent(s.accent as CourseAccent | undefined);
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <span
          className={`inline-grid h-6 min-w-[30px] place-items-center rounded-full px-2 text-xs font-semibold tabular-nums text-white ${a.bg}`}
        >
          {String(index).padStart(2, '0')}
        </span>
        {s.kicker && (
          <span
            className={`text-xs font-semibold uppercase tracking-[0.1em] ${a.deepText}`}
          >
            {s.kicker}
          </span>
        )}
      </div>
      {section.header.title && (
        <h1 className="text-[1.72em] font-semibold leading-tight tracking-tight text-mcr-db-500 [text-wrap:balance]">
          {section.header.title}
        </h1>
      )}
      {s.lede && (
        <p className="leading-relaxed text-mcr-db-400 [text-wrap:pretty]">{s.lede}</p>
      )}
    </header>
  );
}

interface Props {
  content: LoadedContent;
  /** override the localStorage progress key (e.g. preview mode) */
  storageKey?: string;
  /**
   * Called once when the learner reaches the final completion step (the
   * completion-layout section, or the last section when there is no completion
   * screen). Receives the most recent quiz score, if any, so the intranet
   * wrapper can record completion.
   */
  onComplete?: (score?: number) => void;
}

/**
 * Public, section-by-section course player. Groups items into section screens
 * and renders one section at a time inside the CourseChrome shell: content
 * sections stack their blocks, quiz sections run a stepped client-side quiz, and
 * the completion section shows the end screen. Progress (current section)
 * persists to localStorage.
 */
export function CoursePlayer({ content, storageKey, onComplete }: Props) {
  const sections = useMemo(() => groupIntoSections(content.items), [content.items]);
  const total = sections.length;
  const key = storageKey ?? `mcr-course-${content.collection.id}`;

  const [sec, setSec] = useState(() => readInitial(key, total));
  const scrollRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number; guard: boolean } | null>(null);

  // Most recent quiz score, surfaced to onComplete so the wrapper can record it.
  const lastScore = useRef<number | undefined>(undefined);
  // Guard so onComplete fires exactly once per completion (not on every re-render
  // while the learner sits on the final step).
  const completedFired = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(key, String(sec));
    } catch {
      /* localStorage unavailable — progress simply won't persist */
    }
  }, [key, sec]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [sec]);

  const section = sections[sec];
  const isComplete = section?.layout === 'completion';
  const isQuiz = section?.layout === 'quiz';
  const accentName = (section?.header.settings as SectionHeaderSettings | undefined)?.accent;
  // Is there a section after this one, and is it the completion screen? These
  // drive the forward-nav button without assuming a fixed course shape.
  const hasForward = sec < total - 1;
  const nextIsCompletion = sections[sec + 1]?.layout === 'completion';
  // Fire onComplete exactly once, only on a genuine user-initiated arrival at
  // the end — never from mount or a localStorage restore (which would record a
  // completion, and issue a certificate, without the learner finishing).
  function fireComplete() {
    if (completedFired.current) return;
    completedFired.current = true;
    onComplete?.(lastScore.current);
  }

  function go(i: number) {
    if (i < 0 || i >= total) return;
    setSec(i);
    // Completion = the learner navigated to the completion screen, or to the
    // final section when it is not a quiz. A quiz-final section completes via
    // the quiz's own onComplete, after every question has been answered.
    const dest = sections[i];
    if (
      dest &&
      (dest.layout === 'completion' ||
        (i === total - 1 && dest.layout !== 'quiz'))
    ) {
      fireComplete();
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    const target = e.target as Element;
    const guard = target.closest?.(SWIPE_GUARD);
    touch.current = { x: t.clientX, y: t.clientY, guard: !!guard };
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!touch.current || touch.current.guard) {
      touch.current = null;
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8) {
      const forward = dx < 0;
      // A quiz section drives its own forward navigation; don't let a swipe skip it.
      if (!(forward && isQuiz)) go(forward ? sec + 1 : sec - 1);
    }
    touch.current = null;
  }

  if (!section) return null;

  const dotLabels = sections.map(
    (s) =>
      (s.header.settings as SectionHeaderSettings | undefined)?.kicker ??
      s.header.title ??
      '',
  );

  // Build one content block's node: the mapped runtime item's renderer.
  const renderContentBlock = (b: CourseSection['blocks'][number]): ReactNode => (
    <BlockRenderer key={b.id} item={b} onRestart={() => go(0)} />
  );

  return (
    <CourseChrome
      title={content.collection.title}
      accentName={accentName as CourseAccent | undefined}
      sectionIndex={sec}
      total={total}
      showBottomBar={!isComplete}
      // Quiz sections advance via their own "Continue"; the last section has no next.
      showNext={hasForward && !isQuiz}
      isFinishStep={hasForward && nextIsCompletion}
      onBack={() => go(sec - 1)}
      onNext={() => go(sec + 1)}
      onJump={go}
      dotLabels={dotLabels}
      scrollRef={scrollRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        key={section.header.id}
        className={`${COURSE_COLUMN} flex flex-col gap-5 pb-10 pt-6`}
      >
        {!isComplete && <Masthead index={sec + 1} section={section} />}

        {section.layout === 'quiz' ? (
          <QuizSection
            section={section}
            onComplete={(score) => {
              lastScore.current = score;
              if (hasForward) {
                go(sec + 1);
              } else {
                // Quiz is the final section: finishing it completes the course.
                fireComplete();
              }
            }}
          />
        ) : (
          section.blocks.map((b) => renderContentBlock(b))
        )}
      </div>
    </CourseChrome>
  );
}

export default CoursePlayer;
