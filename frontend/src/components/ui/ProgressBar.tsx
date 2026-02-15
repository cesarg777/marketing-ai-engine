"use client";

export interface ProgressBarProps {
  percent: number;
  indeterminate?: boolean;
  size?: "sm" | "md";
  variant?: "default" | "success";
  className?: string;
}

function ProgressBar({
  percent,
  indeterminate = false,
  size = "md",
  variant = "default",
  className = "",
}: ProgressBarProps) {
  const height = size === "sm" ? "h-1.5" : "h-2.5";
  const fill =
    variant === "success"
      ? "bg-emerald-500"
      : "bg-indigo-500";

  return (
    <div
      className={`w-full rounded-full overflow-hidden ${height} ${className}`}
      style={{ background: "var(--surface-overlay)" }}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {indeterminate ? (
        <div
          className={`h-full rounded-full ${fill} animate-progress-indeterminate`}
          style={{ width: "40%" }}
        />
      ) : (
        <div
          className={`h-full rounded-full ${fill} transition-[width] duration-700 ease-out`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      )}
    </div>
  );
}

export { ProgressBar };
