import type { HTMLAttributes } from "react";

type Variant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple";
type Size = "sm" | "md";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  default: "bg-zinc-700/50 text-zinc-300",
  success:
    "bg-[var(--status-success-muted)] text-[var(--status-success)]",
  warning:
    "bg-[var(--status-warning-muted)] text-[var(--status-warning)]",
  danger:
    "bg-[var(--status-danger-muted)] text-[var(--status-danger)]",
  info: "bg-[var(--status-info-muted)] text-[var(--status-info)]",
  purple:
    "bg-[var(--status-purple-muted)] text-[var(--status-purple)]",
};

const sizeStyles: Record<Size, string> = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2 py-0.5",
};

function Badge({
  variant = "default",
  size = "md",
  children,
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        leading-none select-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge };
