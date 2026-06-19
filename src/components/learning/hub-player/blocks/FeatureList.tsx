import type { ContentItemWithOptions, FeatureListSettings, CourseAccent } from '@/types/chat-content';
import MarkdownRenderer from '@/components/learning/hub-player/MarkdownRenderer';
import { accent } from '@/lib/course/courseAccent';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';

/** Crude markdown sniff: only spin up the renderer when there's actual syntax. */
const MARKDOWN_RE = /[*_`#[\]]|\]\(|^\s*[-+>]\s|!\[/;
function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN_RE.test(text);
}

/** Maps a variant to its row marker: accent + icon (or a dot for plain rows). */
function markerFor(variant: FeatureListSettings['variant']): {
  tone: CourseAccent;
  icon: string | null;
} {
  switch (variant) {
    case 'do':
    case 'check':
      return { tone: 'green', icon: 'check' };
    case 'dont':
      return { tone: 'wine', icon: 'x' };
    default:
      return { tone: 'dark-blue', icon: null };
  }
}

/**
 * A vertical list of points with a per-variant row marker (do/don't checklist
 * or a plain bulleted/iconed list). Ports `OutcomeList` (course-ui.jsx) and
 * `GuideList` (course-sections.jsx) from the Safeguarding prototype.
 */
export function FeatureList({ item }: { item: ContentItemWithOptions }) {
  const s = (item.settings ?? {}) as unknown as FeatureListSettings;
  const variant = s.variant ?? 'plain';
  const items = Array.isArray(s.items) ? s.items : [];
  const { tone, icon } = markerFor(variant);
  const a = accent(tone);

  return (
    <ul className="flex flex-col gap-3">
      {items.map((row, i) => {
        const rowIcon = variant === 'plain' ? row.icon : icon;
        // Rows have no stable id (FeatureListItem is { icon?, text }), so we key
        // by index.
        return (
          <li
            key={i}
            className="flex items-start gap-3 text-[0.96em] leading-relaxed text-mcr-db-400"
          >
            <span
              data-testid="feature-marker"
              className={`mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full ${a.tintBg} ${a.deepText}`}
            >
              {rowIcon ? (
                <CourseIcon name={rowIcon} size={14} />
              ) : (
                <span className={`h-[7px] w-[7px] rounded-full ${a.deepBg}`} aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              {looksLikeMarkdown(row.text) ? (
                <MarkdownRenderer content={row.text} />
              ) : (
                row.text
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
