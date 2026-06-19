import { Image as ImageIcon } from 'lucide-react';
import type { ContentItemWithOptions, ImageItemSettings } from '@/types/chat-content';

/**
 * A full-width image with an optional caption (ports the media-block pattern
 * from VideoBlock). The image fills the content column at its natural aspect
 * ratio. When `settings.url` is absent we render a dashed placeholder instead
 * of an <img>. Alt text (settings.alt) and the source (settings.url) are set in
 * the inspector; the caption is rendered read-only here.
 */
export function ImageBlock({ item }: { item: ContentItemWithOptions }) {
  const s = (item.settings ?? {}) as ImageItemSettings;

  return (
    <figure className="flex flex-col">
      {s.url ? (
        <img
          src={s.url}
          alt={s.alt ?? ''}
          loading="lazy"
          decoding="async"
          className="block w-full rounded-2xl"
        />
      ) : (
        <div className="grid aspect-[16/10] w-full place-items-center rounded-2xl border-2 border-dashed border-mcr-db-100 bg-mcr-db-50 text-mcr-db-300">
          <span className="flex flex-col items-center gap-1.5 text-sm font-medium">
            <ImageIcon className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
            No image
          </span>
        </div>
      )}

      {s.caption && (
        <figcaption className="mt-2 text-[0.9em] leading-relaxed text-mcr-db-400">
          {s.caption}
        </figcaption>
      )}
    </figure>
  );
}
