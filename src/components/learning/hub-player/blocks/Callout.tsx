import type { ContentItemWithOptions, CalloutSettings, CourseAccent } from '@/types/chat-content';
import MarkdownRenderer from '@/components/learning/hub-player/MarkdownRenderer';
import { accent } from '@/lib/course/courseAccent';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';

/** Semantic tones map onto brand accents. */
const SEMANTIC_TONE: Record<string, CourseAccent> = {
  info: 'light-blue',
  warning: 'orange',
  muted: 'dark-blue',
};

/**
 * A tinted, bordered callout panel (content warnings, notes, pull-quotes).
 * Ports the `.callout` block from the Safeguarding prototype.
 */
export function Callout({ item }: { item: ContentItemWithOptions }) {
  const s = (item.settings ?? {}) as CalloutSettings;
  const toneName: CourseAccent = s.tone
    ? SEMANTIC_TONE[s.tone] ?? (s.tone as CourseAccent)
    : 'light-blue';
  const a = accent(toneName);

  return (
    <aside className={`flex gap-3 rounded-xl border border-black/5 p-4 ${a.tintBg}`}>
      <span className={`mt-0.5 flex-none ${a.deepText}`}>
        <CourseIcon name={s.icon ?? 'alert'} size={20} />
      </span>
      <div className="flex flex-col gap-1">
        {s.title && (
          <strong className={`text-sm font-semibold ${a.deepText}`}>{s.title}</strong>
        )}
        {item.content && (
          <div className="text-[0.94em] leading-relaxed text-mcr-db-400">
            <MarkdownRenderer content={item.content} />
          </div>
        )}
      </div>
    </aside>
  );
}
