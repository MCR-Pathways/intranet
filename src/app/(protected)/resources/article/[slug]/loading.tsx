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

      {/* Two-column article layout (§4): content column + reading rail */}
      <div className="flex gap-8">
        <div className="min-w-0 flex-1 space-y-5">
          {/* Article title skeleton */}
          <div className="h-7 w-80 rounded bg-muted" />

          {/* Article meta skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="h-4 w-28 rounded bg-muted" />
          </div>

          {/* Article body skeleton — mirrors the 90ch reading measure */}
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

        {/* Reading-rail skeleton — hidden where the disclosure takes over */}
        <div className="hidden w-56 shrink-0 space-y-2.5 lg:block xl:w-64">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-4 w-36 rounded bg-muted" />
          <div className="h-4 w-28 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
