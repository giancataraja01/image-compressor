import type { CompressionOptions } from "../types";
import type { ValidationErrors } from "../utils/validate";
import { PRESETS } from "../utils/presets";
import type { PresetId } from "../utils/presets";

interface SettingsPanelProps {
  options: CompressionOptions;
  setOptions: React.Dispatch<React.SetStateAction<CompressionOptions>>;
  outputDir: string | null;
  onPickOutput: () => void;
  errors: ValidationErrors;
  activePreset: PresetId;
  onPresetChange: (id: PresetId) => void;
}

export default function SettingsPanel({
  options,
  setOptions,
  outputDir,
  onPickOutput,
  errors,
  activePreset,
  onPresetChange,
}: SettingsPanelProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* Left column — compression settings */}
      <div className="rounded-xl border border-white/[0.06] bg-surface-raised/60 p-4 space-y-4 shadow-card">
        <h3 className="text-[12px] font-medium tracking-wide text-zinc-400 uppercase">Compression</h3>

        {/* Preset selector */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-zinc-500">Preset</span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPresetChange(p.id)}
                title={p.description}
                className={`
                  rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all
                  ${activePreset === p.id
                    ? "bg-accent/90 text-white shadow-[0_1px_4px_rgba(10,132,255,0.3)]"
                    : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200"}
                `}
              >
                {p.label}
              </button>
            ))}
            {activePreset === "custom" && (
              <span className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-zinc-600">
                Custom
              </span>
            )}
          </div>
        </div>

        {/* Output format */}
        <div className="space-y-1.5">
          <label htmlFor="format" className="text-[11px] font-medium text-zinc-500">
            Output format
          </label>
          <select
            id="format"
            value={options.outputFormat}
            onChange={(e) =>
              setOptions((o) => ({
                ...o,
                outputFormat: e.target.value as CompressionOptions["outputFormat"],
              }))
            }
            className="w-full rounded-lg border border-white/[0.06] bg-surface-overlay/80 px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-accent/50"
          >
            <option value="original">Same as original</option>
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
        </div>

        {/* Quality slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="quality" className="text-[11px] font-medium text-zinc-500">
              Quality
            </label>
            <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-zinc-300">{options.quality}%</span>
          </div>
          <input
            id="quality"
            type="range"
            min={1}
            max={100}
            value={options.quality}
            disabled={options.lossless}
            onChange={(e) => setOptions((o) => ({ ...o, quality: Number(e.target.value) }))}
            className="w-full accent-accent disabled:opacity-30"
          />
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>Smaller file</span>
            <span>Higher quality</span>
          </div>
          {errors.quality && (
            <p className="text-[11px] text-red-400">{errors.quality}</p>
          )}
        </div>

        {/* Toggle row */}
        <div className="flex items-center gap-5">
          {/* Lossless */}
          <label className="flex items-center gap-2 text-[12px] text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.lossless}
              onChange={(e) => setOptions((o) => ({ ...o, lossless: e.target.checked }))}
              className="h-3.5 w-3.5 rounded border-white/[0.1] bg-surface-overlay accent-accent"
            />
            Lossless
          </label>
          {/* Strip metadata */}
          <label className="flex items-center gap-2 text-[12px] text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.stripMetadata}
              onChange={(e) => setOptions((o) => ({ ...o, stripMetadata: e.target.checked }))}
              className="h-3.5 w-3.5 rounded border-white/[0.1] bg-surface-overlay accent-accent"
            />
            Strip metadata
          </label>
        </div>

        {/* Max dimension (resize) */}
        <div className="space-y-1.5">
          <label htmlFor="maxDim" className="text-[11px] font-medium text-zinc-500">
            Max dimension <span className="text-zinc-600">(px)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="maxDim"
              type="number"
              min={0}
              step={1}
              value={options.maxDimension || ""}
              placeholder="No limit"
              onChange={(e) => {
                const v = e.target.value === "" ? 0 : Math.max(0, Math.round(Number(e.target.value)));
                setOptions((o) => ({ ...o, maxDimension: v }));
              }}
              className="w-full rounded-lg border border-white/[0.06] bg-surface-overlay/80 px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-accent/50"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {[0, 1920, 2560, 4096].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setOptions((o) => ({ ...o, maxDimension: d }))}
                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  options.maxDimension === d
                    ? "bg-accent/20 text-accent"
                    : "bg-white/[0.04] text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300"
                }`}
              >
                {d === 0 ? "None" : `${d}px`}
              </button>
            ))}
          </div>
        </div>

        {/* Lossless info */}
        {options.lossless && (
          <p className="rounded-lg bg-amber-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-400/80">
            Lossless keeps full quality. File size savings may be minimal for already-optimized images.
          </p>
        )}
      </div>

      {/* Right column — output folder */}
      <div className="rounded-xl border border-white/[0.06] bg-surface-raised/60 p-4 space-y-3 shadow-card">
        <h3 className="text-[12px] font-medium tracking-wide text-zinc-400 uppercase">Save to</h3>
        <p
          className="truncate rounded-lg border border-white/[0.06] bg-surface-overlay/80 px-3 py-2 text-[13px] text-zinc-500"
          title={outputDir || "Not selected"}
        >
          {outputDir || "No folder selected"}
        </p>
        <button
          type="button"
          onClick={onPickOutput}
          className="w-full rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-[13px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.08]"
        >
          Choose folder…
        </button>
        {errors.outputDir && (
          <p className="text-[11px] text-red-400">{errors.outputDir}</p>
        )}
      </div>
    </div>
  );
}
