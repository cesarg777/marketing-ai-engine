import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-indigo-600 text-white shadow-[var(--shadow-sm)] " +
    "hover:bg-indigo-500 hover:shadow-[var(--shadow-glow)] " +
    "active:bg-indigo-700 " +
    "focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
  secondary:
    "bg-zinc-800/60 text-zinc-200 border border-[var(--border-default)] " +
    "hover:bg-zinc-700/60 hover:border-[var(--border-hover)] hover:text-white " +
    "active:bg-zinc-800 " +
    "focus-visible:ring-2 focus-visible:ring-zinc-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
  danger:
    "bg-red-500/10 text-red-400 border border-red-500/20 " +
    "hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-300 " +
    "active:bg-red-500/25 " +
    "focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
  ghost:
    "text-zinc-400 " +
    "hover:bg-zinc-800/60 hover:text-zinc-200 " +
    "active:bg-zinc-800 " +
    "focus-visible:ring-2 focus-visible:ring-zinc-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
};

const sizeStyles: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1.5 gap-1.5 rounded-md",
  md: "text-sm px-4 py-2 gap-2 rounded-lg",
  lg: "text-sm px-5 py-2.5 gap-2 rounded-lg",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      children,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center font-medium
          transition-all duration-200 ease-out
          disabled:opacity-40 disabled:pointer-events-none
          select-none cursor-pointer
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Loader2 size={size === "sm" ? 14 : 16} className="animate-spin" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
