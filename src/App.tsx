import { useState, useCallback, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useCompression } from "./hooks/useCompression";
import { useOutputFolder } from "./hooks/useOutputFolder";
import { useFileDrop, isSupportedImage } from "./hooks/useFileDrop";
import { useCompressQueue } from "./hooks/useCompressQueue";
import type { FileUpdate, BatchSummary } from "./hooks/useCompressQueue";
import type { DropResult } from "./hooks/useFileDrop";
import type { ImageFile, CompressionOptions } from "./types";
import { validate, isValid } from "./utils/validate";
import type { ValidationErrors } from "./utils/validate";
import { matchPreset, getPreset } from "./utils/presets";
import type { PresetId } from "./utils/presets";
import { friendlyFileInfoError } from "./utils/errors";
import { fmtSize } from "./utils/format";
import Header from "./components/Header";
import DropZone from "./components/DropZone";
import FileList from "./components/FileList";
import SettingsPanel from "./components/SettingsPanel";
import ResultsTable from "./components/ResultsTable";
import StatusBar from "./components/StatusBar";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const SUPPORTED_EXT = ["jpg", "jpeg", "png", "webp"];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function App() {
  const { checkVipsInstalled, getFileInfo, compressImage } = useCompression();

  /* — state — */
  const [files, setFiles] = useState<ImageFile[]>([]);
  const { outputDir, pickOutputFolder } = useOutputFolder();
  const [options, setOptions] = useState<CompressionOptions>({
    outputFormat: "original",
    quality: 80,
    lossless: false,
    stripMetadata: true,
    maxDimension: 0,
  });
  const [isCompressing, setIsCompressing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [vipsVersion, setVipsVersion] = useState<string | null>(null);
  const [vipsError, setVipsError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [summary, setSummary] = useState<BatchSummary | null>(null);

  /* — preset — */
  const activePreset = matchPreset(options);
  const handlePresetChange = useCallback((id: PresetId) => {
    const preset = getPreset(id);
    if (preset) setOptions(preset.options);
  }, []);

  const logRef = useRef<HTMLDivElement>(null);

  /* — helpers — */
  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    requestAnimationFrame(() => {
      logRef.current?.scrollTo(0, logRef.current.scrollHeight);
    });
  }, []);

  /* — vips check — */
  useEffect(() => {
    checkVipsInstalled().then((status) => {
      if (status.success && status.version) {
        setVipsVersion(status.version);
      } else {
        setVipsError(status.error ?? "vips not found");
      }
    });
  }, [checkVipsInstalled]);

  /* — add files (dedup handled by caller / hook) — */
  const addFiles = useCallback(
    async (paths: string[]) => {
      const added: ImageFile[] = [];

      for (const p of paths) {
        try {
          const info = await getFileInfo(p);
          added.push({
            id: crypto.randomUUID(),
            path: info.path,
            name: info.name,
            size: info.size,
            format: info.format as ImageFile["format"],
            status: "pending",
          });
        } catch (err) {
          const name = p.split("/").pop() ?? p;
          const msg = friendlyFileInfoError(typeof err === "string" ? err : String(err));
          log(`Skipped ${name} — ${msg}`);
        }
      }
      if (added.length > 0) {
        setFiles((prev) => [...prev, ...added]);
        log(`Added ${added.length} image${added.length > 1 ? "s" : ""}`);
      }
    },
    [log, getFileInfo]
  );

  /* — drop handler (called by useFileDrop) — */
  const handleDrop = useCallback(
    (result: DropResult) => {
      if (result.rejected.length > 0) {
        const names = result.rejected.map((p) => p.split("/").pop()).join(", ");
        log(`Skipped ${result.rejected.length} unsupported: ${names}`);
      }
      if (result.duplicates.length > 0) {
        log(`Skipped ${result.duplicates.length} duplicate${result.duplicates.length > 1 ? "s" : ""}`);
      }
      if (result.accepted.length > 0) {
        addFiles(result.accepted);
      }
    },
    [addFiles, log]
  );

  /* — drag & drop (Tauri native) — */
  const { isDragging } = useFileDrop({
    existingPaths: files.map((f) => f.path),
    onDrop: handleDrop,
  });

  /* — file picker — */
  const handleBrowse = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Images", extensions: SUPPORTED_EXT }],
    });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      const images = paths.filter(isSupportedImage);
      if (images.length > 0) addFiles(images);
    }
  }, [addFiles]);

  /* — output folder — */
  const handlePickOutput = useCallback(async () => {
    const dir = await pickOutputFolder();
    if (dir) log(`Output folder: ${dir}`);
  }, [pickOutputFolder, log]);

  /* — remove file — */
  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  /* — clear done — */
  const clearDone = useCallback(() => {
    setFiles((prev) => prev.filter((f) => f.status !== "done" && f.status !== "error"));
  }, []);

  /* — file status updater (called by compress queue) — */
  const handleFileUpdate = useCallback((update: FileUpdate) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === update.id
          ? {
              ...f,
              status: update.status,
              compressedSize: update.compressedSize ?? f.compressedSize,
              outputPath: update.outputPath ?? f.outputPath,
              error: update.error ?? f.error,
            }
          : f
      )
    );
  }, []);

  /* — compress queue — */
  const queue = useCompressQueue({
    compressImage,
    onFileUpdate: handleFileUpdate,
    onLog: log,
  });

  /* — compress — */
  const handleCompress = useCallback(async () => {
    setShowErrors(true);
    const errors = validate(files, outputDir, options);
    if (!isValid(errors) || isCompressing) return;
    setSummary(null);
    setIsCompressing(true);
    const result = await queue.start(files, outputDir!, options);
    setIsCompressing(false);
    if (result) setSummary(result);
  }, [files, outputDir, options, isCompressing, queue]);

  /* — derived — */
  const pendingCount = files.filter((f) => f.status === "pending").length;
  const errors: ValidationErrors = validate(files, outputDir, options);
  const canCompress = isValid(errors) && !isCompressing;
  const hasResults = files.some((f) => f.status === "done" || f.status === "error");
  const visibleErrors = showErrors ? errors : {};

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="mx-auto flex w-full max-w-[700px] flex-1 flex-col gap-4 px-6 py-8 select-none">
      <Header vipsVersion={vipsVersion} vipsError={vipsError} />
      <DropZone isDragging={isDragging} onBrowse={handleBrowse} fileError={visibleErrors.files} />
      <FileList files={files} hasResults={hasResults} onRemove={removeFile} onClearDone={clearDone} />
      <SettingsPanel options={options} setOptions={setOptions} outputDir={outputDir} onPickOutput={handlePickOutput} errors={visibleErrors} activePreset={activePreset} onPresetChange={handlePresetChange} />

      {/* ---- Compress button ---- */}
      <button
        type="button"
        disabled={!canCompress}
        onClick={handleCompress}
        className={`
          w-full rounded-xl py-3 text-[13px] font-semibold tracking-wide transition-all
          ${
            canCompress
              ? "bg-accent text-white shadow-[0_2px_10px_rgba(10,132,255,0.3)] hover:bg-accent-hover hover:shadow-[0_2px_14px_rgba(10,132,255,0.4)] active:scale-[0.99]"
              : "cursor-not-allowed bg-white/[0.04] text-zinc-600"
          }
        `}
      >
        {isCompressing
          ? `Compressing… (${queue.completed}/${queue.total})`
          : pendingCount === 0
            ? "Compress images"
            : `Compress ${pendingCount} image${pendingCount !== 1 ? "s" : ""}`}
      </button>

      <StatusBar logs={logs} logRef={logRef} onClear={() => setLogs([])} />

      {/* ---- Batch summary ---- */}
      {summary && !isCompressing && (
        <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] px-4 py-3 text-[12px] text-zinc-300">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] text-emerald-400">✓</span>
            <span className="font-medium text-zinc-200">
              {summary.succeeded} image{summary.succeeded !== 1 ? "s" : ""} compressed
              {summary.failed > 0 && <span className="text-red-400"> · {summary.failed} failed</span>}
            </span>
          </div>
          {summary.totalOriginal > 0 && (
            <p className="mt-1.5 pl-7 text-zinc-500">
              {fmtSize(summary.totalOriginal)} → {fmtSize(summary.totalCompressed)}
              {" · "}
              <span className="text-emerald-400/80">saved {fmtSize(summary.totalOriginal - summary.totalCompressed)}</span>
              {" · "}
              {(summary.elapsedMs / 1000).toFixed(1)}s
            </p>
          )}
        </div>
      )}

      <ResultsTable files={files} />

      <p className="mt-4 text-center text-[11px] text-zinc-600">
        Created By Gian Cataraja
      </p>
    </div>
  );
}
