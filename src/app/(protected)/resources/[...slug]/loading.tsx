export default function CategoryLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Breadcrumbs skeleton */}
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-10 rounded bg-muted" />
        <div className="h-4 w-2 rounded bg-muted" />
        <div className="h-4 w-16 rounded bg-muted" />
        <div className="h-4 w-2 rounded bg-muted" />
        <div className="h-4 w-28 rounded bg-muted" />
      </div>

      {/* Category header skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-11 w-11 rounded-xl bg-muted" />
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="h-4 w-72 rounded bg-muted" />
        </div>
      </div>

      {/* Subcategory cards skeleton */}
      <div>
        <div className="h-4 w-24 rounded bg-muted mb-3" />
        <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[10px] border border-border px-4 py-3.5"
            >
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="h-3 w-16 rounded bg-muted mt-2" />
            </div>
          ))}
        </div>
      </div>

      {/* Article list skeleton */}
      <div>
        <div className="h-4 w-16 rounded bg-muted mb-3" />
        <div className="rounded-lg bg-background p-1 space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3.5 py-3">
              <div className="h-[18px] w-[18px] rounded bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-48 rounded bg-muted" />
                <div className="h-3 w-32 rounded bg-muted" />
              </div>
              <div className="h-4 w-4 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
