'use client';

import type { ReactNode, RefObject } from 'react';
import type { CourseAccent } from '@/types/chat-content';
import { accent } from '@/lib/course/courseAccent';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';

/**
 * Shared centered content column. Caps line length on desktop (~1000px) and
 * keeps the app bar, content, and bottom bar aligned to the same column while
 * their borders/background stay full-bleed. Includes the `px-5` gutter so the
 * three regions can't drift and full-bleed blocks (`-mx-5`) align to the column
 * edge. Applied in CoursePlayer too.
 */
export const COURSE_COLUMN = 'mx-auto w-full max-w-[1000px] px-5';

/** MCR "MR" monogram (from the prototype app bar). */
function Monogram() {
  return (
    <svg
      width="22"
      height="19"
      viewBox="0 0 52 45"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M37.6473 0C24.2175 0 23.4552 0.762475 23.4552 14.1956V19.5549C23.4552 32.988 24.2175 33.7505 37.6473 33.7505C38.216 33.7505 38.7608 33.7505 39.2856 33.7445L31.4991 44.7425C48.1995 44.7425 51.8374 41.1038 51.8374 24.3992V14.1956C51.8394 0.762475 51.0771 0 37.6473 0Z"
        fill="#213350"
      />
      <path
        d="M9.81791 2.79641C0.526815 2.79641 0 3.32335 0 12.6168V19.6767C0 31.2335 2.51833 33.7505 14.0703 33.7505L8.68446 26.1417C9.04764 26.1437 9.42479 26.1457 9.81791 26.1457C19.109 26.1457 19.6358 25.6188 19.6358 16.3254V12.6168C19.6358 3.32335 19.109 2.79641 9.81791 2.79641Z"
        fill="#213350"
      />
    </svg>
  );
}

export interface CourseChromeProps {
  title: string;
  accentName?: CourseAccent;
  /** 0-based index of the current section */
  sectionIndex: number;
  total: number;
  showBottomBar: boolean;
  /** when false, the forward Continue/Finish button is hidden (e.g. quiz
   * sections drive their own advancement, and the last section has no next) */
  showNext?: boolean;
  /** when true, the Continue button reads "Finish" */
  isFinishStep: boolean;
  onBack: () => void;
  onNext: () => void;
  onJump: (i: number) => void;
  /** per-section labels for dot aria-labels */
  dotLabels: string[];
  scrollRef: RefObject<HTMLDivElement | null>;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  children: ReactNode;
}

/**
 * Full-screen course player shell: app bar (monogram + title + counter +
 * accent progress fill), a scrollable content area, and a bottom navigation bar
 * (Back / section dots / Continue|Finish). Ports the `CourseScreen` chrome from
 * the Safeguarding prototype.
 */
export function CourseChrome({
  title,
  accentName,
  sectionIndex,
  total,
  showBottomBar,
  showNext = true,
  isFinishStep,
  onBack,
  onNext,
  onJump,
  dotLabels,
  scrollRef,
  onTouchStart,
  onTouchEnd,
  children,
}: CourseChromeProps) {
  const a = accent(accentName);
  const progress = total > 1 ? sectionIndex / (total - 1) : 1;

  return (
    <div className="flex h-[100dvh] flex-col bg-mcr-ivory">
      {/* App bar */}
      <header className="flex-none border-b border-black/5 bg-mcr-ivory">
        <div className={`${COURSE_COLUMN} pb-2 pt-3`}>
          <div className="flex items-center gap-3">
            <Monogram />
            <span className="flex-1 text-sm font-semibold text-mcr-db-500">{title}</span>
            <span className="text-xs font-semibold tabular-nums text-mcr-db-300">
              {sectionIndex + 1} <span className="text-mcr-db-200">/ {total}</span>
            </span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/5">
            <span
              className={`block h-full rounded-full transition-[width] duration-300 ${a.bg}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>

      {/* Bottom bar */}
      {showBottomBar && (
        <nav className="flex-none border-t border-black/5 bg-mcr-ivory">
          <div className={`${COURSE_COLUMN} flex items-center gap-3 py-3`}>
            <button
              type="button"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-black/10 text-mcr-db-400 disabled:opacity-40"
              disabled={sectionIndex === 0}
              onClick={onBack}
              aria-label="Back"
            >
              <CourseIcon name="chevL" size={20} />
            </button>

            <div className="flex flex-1 items-center justify-center gap-1.5">
              {dotLabels.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to ${label || `section ${i + 1}`}`}
                  aria-current={i === sectionIndex ? 'step' : undefined}
                  onClick={() => onJump(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === sectionIndex
                      ? `w-5 ${a.bg}`
                      : i < sectionIndex
                        ? 'w-2 bg-mcr-db-300'
                        : 'w-2 bg-black/15'
                  }`}
                />
              ))}
            </div>

            {showNext ? (
              <button
                type="button"
                onClick={onNext}
                className={`flex h-11 min-w-[44px] flex-none items-center gap-1.5 rounded-full px-5 text-sm font-semibold text-white ${
                  isFinishStep ? 'bg-mcr-pink' : 'bg-mcr-darkblue'
                }`}
              >
                {isFinishStep ? 'Finish' : 'Continue'}
                <CourseIcon name="arrowR" size={18} />
              </button>
            ) : (
              // Keep the bar balanced (Back on the left) when there's no forward control.
              <span className="h-11 w-11 flex-none" aria-hidden="true" />
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
