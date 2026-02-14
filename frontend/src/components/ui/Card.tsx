import type { HTMLAttributes, ReactNode } from "react";

type Padding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: Padding;
  children: ReactNode;
}

const paddingStyles: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

function Card({
  hover = false,
  padding = "md",
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`
        bg-[var(--surface-raised)] border border-[var(--border-subtle)]
        rounded-xl shadow-[var(--shadow-sm)]
        transition-all duration-200 ease-out
        ${hover ? "hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-md)]" : ""}
        ${paddingStyles[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export { Card };
