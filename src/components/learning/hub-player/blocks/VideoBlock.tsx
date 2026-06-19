'use client';

import { useState } from 'react';
import type { ContentItemWithOptions, VideoItemSettings } from '@/types/chat-content';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';

/**
 * A video poster slot with an accessible transcript toggle (ports the prototype
 * `VideoBlock`). v1 ships no real videos: when `settings.poster` is present we
 * render it as an <img>, otherwise a tinted placeholder box. A floating play
 * badge and a small label tag sit over the 16:10 poster. Below, a "Read
 * transcript" button toggles the transcript paragraph — the accessibility-
 * critical control, wired with aria-expanded.
 */
export function VideoBlock({ item }: { item: ContentItemWithOptions }) {
  const s = (item.settings ?? {}) as VideoItemSettings;
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <div className="relative overflow-hidden rounded-2xl">
        {s.poster ? (
          <img
            src={s.poster}
            alt={s.label ?? 'Video poster'}
            className="block aspect-[16/10] w-full object-cover"
          />
        ) : (
          <div className="grid aspect-[16/10] w-full place-items-center bg-mcr-db-500" />
        )}

        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 grid h-[54px] w-[54px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-mcr-ivory/90 text-mcr-darkblue shadow-lg"
        >
          <CourseIcon name="play" size={26} />
        </span>

        {s.label && (
          <span
            title={s.label}
            className="absolute bottom-3 left-3 rounded-full bg-mcr-db-700/80 px-2.5 py-1 text-xs font-semibold text-mcr-ivory backdrop-blur-sm"
          >
            {s.label}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`transcript-${item.id}`}
        className="mt-3 inline-flex min-h-[44px] items-center gap-2 self-start text-[0.9em] font-semibold text-mcr-lb-700"
      >
        <CourseIcon name="book" size={16} />
        {open ? 'Hide transcript' : 'Read transcript'}
        <span
          className={`inline-flex transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        >
          <CourseIcon name="chevR" size={16} />
        </span>
      </button>

      {open && s.transcript && (
        <p
          id={`transcript-${item.id}`}
          className="mt-2.5 animate-course-reveal whitespace-pre-wrap rounded-xl bg-mcr-db-50 px-4 py-3.5 text-[0.94em] leading-relaxed text-mcr-db-400 motion-reduce:animate-none"
        >
          {s.transcript}
        </p>
      )}
    </div>
  );
}
