export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-paper-200 dark:bg-paper-800 ${className}`}
    />
  );
}

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-paper-100 last:border-0 dark:border-paper-800">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className={`h-4 ${i === 0 ? "w-2/3" : "w-12"}`} />
        </td>
      ))}
    </tr>
  );
}
