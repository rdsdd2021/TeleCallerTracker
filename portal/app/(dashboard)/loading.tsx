export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Skeleton header */}
      <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
      {/* Skeleton stat cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
      {/* Skeleton table */}
      <div className="space-y-2">
        <div className="h-10 bg-muted animate-pulse rounded-md" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    </div>
  )
}
