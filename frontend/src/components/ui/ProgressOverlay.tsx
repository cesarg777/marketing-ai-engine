"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "./ProgressBar";
import { CheckCircle } from "lucide-react";

export interface ProgressStep {
  label: string;
  durationMs: number;
}

export interface ProgressOverlayProps {
  steps: ProgressStep[];
  isActive: boolean;
  className?: string;
}

function ProgressOverlay({ steps, isActive, className = "" }: ProgressOverlayProps) {
  const [percent, setPercent] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasActive = useRef(false);

  // Total duration for calculating per-step percent ranges
  const totalDuration = steps.reduce((sum, s) => sum + s.durationMs, 0);

  useEffect(() => {
    if (isActive && !wasActive.current) {
      // Starting fresh
      wasActive.current = true;
      setPercent(0);
      setStepIndex(0);
      setCompleted(false);

      let elapsed = 0;
      const tick = 200; // update every 200ms

      intervalRef.current = setInterval(() => {
        elapsed += tick;

        // Calculate which step we're in and overall percent
        let cumulative = 0;
        let currentStep = 0;
        for (let i = 0; i < steps.length; i++) {
          if (elapsed >= cumulative + steps[i].durationMs) {
            cumulative += steps[i].durationMs;
            currentStep = Math.min(i + 1, steps.length - 1);
          } else {
            currentStep = i;
            break;
          }
        }

        setStepIndex(currentStep);

        // Calculate percent: map elapsed to 0-90 range (hold at 90 until done)
        const raw = (elapsed / totalDuration) * 90;
        setPercent(Math.min(raw, 90));

        // If we've gone through all step durations, just stay at 90
        if (elapsed >= totalDuration) {
          setPercent(90);
        }
      }, tick);
    }

    if (!isActive && wasActive.current) {
      // Operation completed
      wasActive.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setPercent(100);
      setCompleted(true);

      // Auto-hide after showing completion
      const timeout = setTimeout(() => {
        setCompleted(false);
        setPercent(0);
        setStepIndex(0);
      }, 2000);

      return () => clearTimeout(timeout);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, steps, totalDuration]);

  // Don't render when idle
  if (!isActive && !completed) return null;

  const currentLabel = completed
    ? "Complete!"
    : steps[stepIndex]?.label ?? "Processing...";

  return (
    <div className={`space-y-3 ${className}`}>
      <ProgressBar
        percent={percent}
        variant={completed ? "success" : "default"}
      />
      <div className="flex items-center gap-2">
        {completed && (
          <CheckCircle size={16} className="text-emerald-400" />
        )}
        <span
          className="text-sm"
          style={{ color: completed ? "var(--status-success)" : "var(--text-secondary)" }}
        >
          {currentLabel}
        </span>
        {!completed && (
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            {Math.round(percent)}%
          </span>
        )}
      </div>
    </div>
  );
}

export { ProgressOverlay };
