// app/ui/dashboard/dashboard-card.tsx
// Shared wrapper for all dashboard panels

export default function DashboardCard({
  title,
  children,
  className = '',
}: {
  title:      string;
  children:   React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col rounded-xl bg-gray-50 p-4 ${className}`}>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <div className="flex grow flex-col rounded-xl bg-white p-4">
        {children}
      </div>
    </div>
  );
}