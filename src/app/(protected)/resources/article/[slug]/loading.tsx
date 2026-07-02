import { ARTICLE_LAYOUT_CLASSES, ARTICLE_HEADER_CLASSES, ARTICLE_COLUMN_CLASSES } from "@/lib/article-constants";

export default function ArticleLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Breadcrumbs skeleton */}
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-10 rounded bg-muted" />
        <div className="h-4 w-2 rounded bg-muted" />
        <div className="h-4 w-16 rounded bg-muted" />
        <div className="h-4 w-2 rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-4 w-2 rounded bg-muted" />
        <div className="h-4 w-40 rounded bg-muted" />
      </div>

      {/* Article layout skeleton — mirrors the shared §4 grid: header, rail, content */}
      <div className={ARTICLE_LAYOUT_CLASSES}>
        <div className={`${ARTICLE_HEADER_CLASSES} space-y-5`}>
          {/* Article title skeleton */}
          <div className="h-7 w-80 max-w-full rounded bg-muted" />

          {/* Article meta skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="h-4 w-28 rounded bg-muted" />
          </div>
        </div>

        {/* Rail slot — placement mirrors ArticleOutline's nav: a disclosure row
            below lg, the side rail from lg */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:w-56 lg:self-start xl:w-64">
          <div className="h-8 w-full rounded bg-muted lg:hidden" />
          <div className="hidden space-y-2.5 lg:block">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-4 w-36 rounded bg-muted" />
            <div className="h-4 w-28 rounded bg-muted" />
          </div>
        </div>

        {/* Article body skeleton — mirrors the 90ch reading measure */}
        <div className={ARTICLE_COLUMN_CLASSES}>
          <div className="space-y-3 max-w-[90ch]">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-5/6 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-4/6 rounded bg-muted" />
            <div className="h-6 w-48 rounded bg-muted mt-6" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-5/6 rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
