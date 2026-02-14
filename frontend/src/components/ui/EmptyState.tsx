import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center py-16 px-6 text-center
        ${className}
      `}
    >
      <div className="mb-4 rounded-xl bg-zinc-800/60 border border-[var(--border-subtle)] p-4">
        <Icon size={28} className="text-zinc-500" strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-zinc-500 max-w-xs mb-4">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export { EmptyState };
