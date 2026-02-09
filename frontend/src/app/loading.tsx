export default function Loading() {
  return (
    <div className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-48" />
      <div className="h-4 bg-muted rounded w-80" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="h-32 bg-muted rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-28 bg-muted rounded-lg" />
        <div className="h-28 bg-muted rounded-lg" />
      </div>
    </div>
  );
}
