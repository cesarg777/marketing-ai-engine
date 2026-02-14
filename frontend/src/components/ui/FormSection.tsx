import type { ReactNode } from "react";

export interface FormSectionProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

function FormSection({
  title,
  children,
  actions,
  className = "",
}: FormSectionProps) {
  return (
    <div
      className={`
        bg-[var(--surface-raised)] border border-[var(--border-subtle)]
        rounded-xl shadow-[var(--shadow-sm)] p-6
        ${className}
      `}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
          {title}
        </h2>
        {actions && <div>{actions}</div>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export { FormSection };
