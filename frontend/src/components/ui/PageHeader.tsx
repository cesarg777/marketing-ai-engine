import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between mb-8 ${className}`}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 rounded-lg bg-[var(--accent-muted)] p-2">
            <Icon size={20} className="text-indigo-400" strokeWidth={1.8} />
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export { PageHeader };
