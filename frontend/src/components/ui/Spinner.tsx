import { Loader2 } from "lucide-react";

type Size = "sm" | "md" | "lg";

export interface SpinnerProps {
  size?: Size;
  className?: string;
}

const sizeMap: Record<Size, number> = {
  sm: 16,
  md: 24,
  lg: 32,
};

function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      role="status"
      aria-label="Loading"
    >
      <Loader2
        size={sizeMap[size]}
        className="animate-spin text-zinc-500"
        strokeWidth={2}
      />
    </div>
  );
}

export { Spinner };
