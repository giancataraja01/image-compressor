import type { RefObject } from "react";

interface StatusBarProps {
  logs: string[];
  logRef: RefObject<HTMLDivElement | null>;
  onClear: () => void;
}

export default function StatusBar({ logs, logRef, onClear }: StatusBarProps) {
  if (logs.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface-raised/60 shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-[12px] font-medium tracking-wide text-zinc-400 uppercase">Activity</span>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Clear
        </button>
      </div>
      <div ref={logRef} className="max-h-28 overflow-y-auto border-t border-white/[0.04] px-4 py-2 font-mono text-[11px] leading-relaxed text-zinc-600">
        {logs.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
    </div>
  );
}
