import MarkdownRenderer from '@/components/learning/hub-player/MarkdownRenderer';
import type { ContentItem, TextItemSettings } from '@/types/chat-content';

// Stable reference for the empty settings case.
const EMPTY_SETTINGS: TextItemSettings = {};

/**
 * Read-only lesson text block. Renders an optional heading, markdown body, and a
 * list of source links. Media (images, audio) in this block is referenced only
 * by Supabase storage paths in the published content; v1 of the player does not
 * sign those paths, so images that have no absolute URL are skipped (resolveImage
 * returns undefined) and the audio narration player is omitted.
 */
export function TextItem({ item }: { item: ContentItem }) {
  const settings = (item.settings ?? EMPTY_SETTINGS) as TextItemSettings;

  return (
    <article className="space-y-3">
      {item.title ? (
        <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
      ) : null}
      <MarkdownRenderer content={item.content ?? ''} />
      {settings.sources && settings.sources.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2 border-t border-mcr-db-100 pt-3 text-xs">
          {settings.sources.map((s) => (
            <li key={s.id}>
              <a
                href={`/admin/articles#article/${s.id}`}
                className="rounded-md border border-mcr-db-100 bg-mcr-ivory px-2 py-0.5 font-medium text-foreground hover:bg-white"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
