"use client";

import { useState, useEffect } from "react";

const ESTIMATED_TIME_SECS = 120; // 2 minutes

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface GenerationProgressProps {
  status: "queued" | "processing";
  queuePosition?: number;
  queueTotal?: number;
  onCancel: () => void;
}

export function GenerationProgress({ status, queuePosition, queueTotal, onCancel }: GenerationProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== "processing") return;
    const start = Date.now() - elapsed * 1000;
    const interval = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 200);
    return () => clearInterval(interval);
  }, [status]);

  const progress = Math.min((elapsed / ESTIMATED_TIME_SECS) * 100, 98); // never hit 100 until truly done
  const remaining = Math.max(ESTIMATED_TIME_SECS - elapsed, 0);

  return (
    <div
      className="flex w-full flex-col gap-6 rounded-2xl border px-8 py-12"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
        aspectRatio: "16/9",
      }}
    >
      {/* Center content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        {/* Spinner */}
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "var(--accent-soft)" }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="animate-spin"
            style={{ animationDuration: "1.5s" }}
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="rgba(124,58,237,0.2)"
              strokeWidth="3"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium text-[var(--foreground)]">
            Generating your video solution…
          </p>
          <p className="text-xs text-[var(--muted)]">
            This usually takes about 2 minutes
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-sm">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, var(--accent), #a78bfa)",
                boxShadow: "0 0 12px rgba(124,58,237,0.4)",
              }}
            />
          </div>
        </div>

        {/* Time info or queued info */}
        {status === "queued" ? (
          <div className="flex items-center gap-4 text-sm font-medium text-[var(--accent)]">
             <span>You are in queue... Position: {queuePosition || 1} of {queueTotal || 1}</span>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-xs">
            <span className="text-[var(--muted)]">
              Elapsed: <span className="font-mono text-[var(--foreground)]">{formatTime(elapsed)}</span>
            </span>
            <span
              className="h-3 w-px"
              style={{ background: "var(--border)" }}
            />
            <span className="text-[var(--muted)]">
              Remaining: ≈ <span className="font-mono text-[var(--foreground)]">{formatTime(remaining)}</span>
            </span>
          </div>
        )}

        <button 
          onClick={onCancel}
          className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-all cursor-pointer border border-red-500/30"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
          Cancel / Pause
        </button>
      </div>
    </div>
  );
}
