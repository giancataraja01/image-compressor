import type { CompressionOptions } from "../types";

/* ------------------------------------------------------------------ */
/*  Preset definitions                                                 */
/* ------------------------------------------------------------------ */

export type PresetId = "max-quality" | "balanced" | "smallest" | "lossless" | "custom";

export interface Preset {
  id: PresetId;
  label: string;
  description: string;
  options: CompressionOptions;
}

/**
 * Ordered list of compression presets.
 *
 * "Balanced" is the recommended default — it targets the sweet-spot
 * where quality loss is barely perceptible but savings are significant,
 * especially for very large (10 MB+) images from cameras or design tools.
 */
export const PRESETS: Preset[] = [
  {
    id: "max-quality",
    label: "High Quality",
    description: "Minimal compression — ideal for print and archival",
    options: { outputFormat: "original", quality: 95, lossless: false, stripMetadata: false, maxDimension: 0 },
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Great quality at a fraction of the size (recommended)",
    options: { outputFormat: "original", quality: 80, lossless: false, stripMetadata: true, maxDimension: 0 },
  },
  {
    id: "smallest",
    label: "Small File",
    description: "Aggressive compression — optimized for web and email",
    options: { outputFormat: "webp", quality: 60, lossless: false, stripMetadata: true, maxDimension: 0 },
  },
  {
    id: "lossless",
    label: "Lossless",
    description: "Zero quality loss — strips only metadata",
    options: { outputFormat: "original", quality: 100, lossless: true, stripMetadata: true, maxDimension: 0 },
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Find which preset (if any) exactly matches the current options. */
export function matchPreset(options: CompressionOptions): PresetId {
  for (const p of PRESETS) {
    if (
      p.options.outputFormat === options.outputFormat &&
      p.options.quality === options.quality &&
      p.options.lossless === options.lossless &&
      p.options.stripMetadata === options.stripMetadata
    ) {
      return p.id;
    }
  }
  return "custom";
}

/** Look up a preset by id. Returns `undefined` for "custom". */
export function getPreset(id: PresetId): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
