import { forwardRef, type TextareaHTMLAttributes } from "react";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helpText, className = "", id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-medium text-zinc-400 tracking-wide"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full bg-[var(--surface-input)] text-sm text-zinc-200
            border rounded-lg px-3 py-2.5
            placeholder:text-zinc-600
            transition-all duration-200 ease-out resize-y min-h-[5rem]
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:opacity-40 disabled:cursor-not-allowed
            ${
              error
                ? "border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20"
                : "border-[var(--border-default)] focus:border-[var(--border-focus)] focus:ring-indigo-500/15"
            }
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
            {error}
          </p>
        )}
        {helpText && !error && (
          <p className="text-xs text-zinc-500">{helpText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
export { Textarea };
