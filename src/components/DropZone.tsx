interface DropZoneProps {
  isDragging: boolean;
  onBrowse: () => void;
  fileError?: string;
}

export default function DropZone({ isDragging, onBrowse, fileError }: DropZoneProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
        px-6 py-14 transition-all duration-200
        ${isDragging
          ? "border-accent/50 bg-accent/[0.04] shadow-[inset_0_0_24px_rgba(10,132,255,0.06)]"
          : "border-white/[0.06] bg-surface-raised/30 hover:border-white/[0.12] hover:bg-surface-raised/50"}
      `}
    >
      <div className={`rounded-full p-3 transition-colors ${isDragging ? "bg-accent/10" : "bg-white/[0.04]"}`}>
        <svg className={`h-6 w-6 transition-colors ${isDragging ? "text-accent" : "text-zinc-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-[13px] text-zinc-400">
          Drop images here, or{" "}
          <button
            type="button"
            onClick={onBrowse}
            className="font-medium text-accent hover:text-accent-hover"
          >
            browse files
          </button>
        </p>
        <p className="mt-1 text-[11px] text-zinc-600">Supports JPEG, PNG, and WebP</p>
      </div>
      {fileError && (
        <p className="text-[11px] text-red-400">{fileError}</p>
      )}
    </div>
  );
}
