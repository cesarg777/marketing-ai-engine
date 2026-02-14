import type { ReactNode } from "react";
import { X, AlertCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react";

type Variant = "error" | "warning" | "success" | "info";

export interface AlertProps {
  variant?: Variant;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const config: Record<
  Variant,
  { bg: string; border: string; text: string; icon: typeof AlertCircle }
> = {
  error: {
    bg: "bg-[var(--status-danger-muted)]",
    border: "border-red-500/20",
    text: "text-red-400",
    icon: AlertCircle,
  },
  warning: {
    bg: "bg-[var(--status-warning-muted)]",
    border: "border-amber-500/20",
    text: "text-amber-400",
    icon: AlertTriangle,
  },
  success: {
    bg: "bg-[var(--status-success-muted)]",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    icon: CheckCircle2,
  },
  info: {
    bg: "bg-[var(--status-info-muted)]",
    border: "border-blue-500/20",
    text: "text-blue-400",
    icon: Info,
  },
};

function Alert({
  variant = "info",
  children,
  onDismiss,
  className = "",
}: AlertProps) {
  const { bg, border, text, icon: Icon } = config[variant];

  return (
    <div
      className={`
        flex items-start gap-3 rounded-lg border px-4 py-3
        ${bg} ${border}
        ${className}
      `}
      role="alert"
    >
      <Icon size={16} className={`${text} mt-0.5 shrink-0`} />
      <div className={`flex-1 text-sm ${text}`}>{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={`${text} opacity-60 hover:opacity-100 transition-opacity shrink-0`}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export { Alert };
