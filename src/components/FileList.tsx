import type { ImageFile } from "../types";
import { fmtSize } from "../utils/format";

interface FileListProps {
  files: ImageFile[];
  hasResults: boolean;
  onRemove: (id: string) => void;
  onClearDone: () => void;
}

export default function FileList({ files, hasResults, onRemove, onClearDone }: FileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface-raised/60 shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-[12px] font-medium tracking-wide text-zinc-400 uppercase">
          Files ({files.length})
        </span>
        {hasResults && (
          <button
            type="button"
            onClick={onClearDone}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear completed
          </button>
        )}
      </div>
      <ul className="max-h-52 divide-y divide-white/[0.04] overflow-y-auto">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-white/[0.02]">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-zinc-200">{f.name}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {fmtSize(f.size)} · {f.format.toUpperCase()}
              </p>
            </div>
            {/* status badge */}
            {f.status === "pending" && (
              <span className="shrink-0 rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-medium text-zinc-500">
                Pending
              </span>
            )}
            {f.status === "compressing" && (
              <span className="shrink-0 animate-pulse rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-medium text-accent">
                Compressing…
              </span>
            )}
            {f.status === "done" && (
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
                Done
              </span>
            )}
            {f.status === "error" && (
              <span className="shrink-0 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-medium text-red-400" title={f.error}>
                Error
              </span>
            )}
            {/* remove */}
            {f.status !== "compressing" && (
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                className="shrink-0 rounded-md p-1 text-zinc-600 hover:bg-white/[0.05] hover:text-zinc-300 transition-colors"
                title="Remove"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
