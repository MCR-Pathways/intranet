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

      {/* Article title skeleton */}
      <div className="h-7 w-80 rounded bg-muted" />

      {/* Article meta skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-4 w-4 rounded bg-muted" />
        <div className="h-4 w-28 rounded bg-muted" />
      </div>

      {/* Article body skeleton */}
      <div className="space-y-3 max-w-[720px]">
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
  );
}
