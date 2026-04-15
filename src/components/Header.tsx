interface HeaderProps {
  vipsVersion: string | null;
  vipsError: string | null;
}

export default function Header({ vipsVersion, vipsError }: HeaderProps) {
  return (
    <header className="space-y-1">
      <div className="flex items-center gap-3">
        <h1 className="text-[20px] font-semibold tracking-tight text-white">
          Image Compressor
        </h1>
        {vipsVersion && (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-medium text-emerald-400/90">
            {vipsVersion}
          </span>
        )}
        {vipsError && (
          <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-medium text-red-400">
            {vipsError}
          </span>
        )}
      </div>
      <p className="text-[13px] leading-relaxed text-zinc-500">
        Shrink large images locally — fast, private, no uploads.
      </p>
    </header>
  );
}
