export interface ToggleProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
  className = "",
}: ToggleProps) {
  return (
    <label
      className={`
        inline-flex items-center gap-2.5 select-none
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative w-10 h-[22px] rounded-full
          transition-colors duration-200 ease-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900
          ${checked ? "bg-indigo-600" : "bg-zinc-700"}
        `}
      >
        <span
          className={`
            absolute top-[3px] w-4 h-4 rounded-full bg-white
            shadow-[var(--shadow-sm)]
            transition-transform duration-200 ease-out
            ${checked ? "translate-x-[22px]" : "translate-x-[3px]"}
          `}
        />
      </button>
      {label && (
        <span className="text-xs text-zinc-400">{label}</span>
      )}
    </label>
  );
}

export { Toggle };
