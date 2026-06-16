export default function CategoryLoading() {
  return (
    <div className="bg-card border border-border shadow-md rounded-xl overflow-clip animate-pulse">
      {/* Padded top section */}
      <div className="p-5 md:p-6 space-y-4">
        {/* Breadcrumbs skeleton */}
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-10 rounded bg-muted" />
          <div className="h-4 w-2 rounded bg-muted" />
          <div className="h-4 w-28 rounded bg-muted" />
        </div>

        {/* Category header skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted shrink-0" />
          <div className="space-y-1.5">
            <div className="h-5 w-48 rounded bg-muted" />
            <div className="h-3.5 w-72 rounded bg-muted" />
          </div>
        </div>
      </div>

      {/* Zebra-striped row skeleton */}
      <div className="border-t border-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={
              "flex items-center gap-2.5 px-5 md:px-6 py-2.5 border-b border-border last:border-b-0 " +
              (i % 2 === 0 ? "bg-muted/50" : "")
            }
          >
            <div className="h-4 w-4 rounded bg-muted shrink-0" />
            <div className="h-4 w-40 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
