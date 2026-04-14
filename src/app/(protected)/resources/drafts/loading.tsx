export default function DraftsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div>
        <div className="h-4 w-32 bg-muted rounded mb-2" />
        <div className="h-7 w-40 bg-muted rounded" />
        <div className="h-4 w-80 bg-muted rounded mt-2" />
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="h-9 bg-muted/40 border-b border-border" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 border-b border-border last:border-b-0" />
        ))}
      </div>
    </div>
  );
}
