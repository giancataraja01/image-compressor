import type { ImageFile } from "../types";
import { fmtSize, fmtPercent, savingsPercent, sortBySavings } from "../utils/format";

interface ResultsTableProps {
  files: ImageFile[];
}

export default function ResultsTable({ files }: ResultsTableProps) {
  const finished = files
    .filter((f) => f.status === "done" || f.status === "error")
    .sort(sortBySavings);

  if (finished.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface-raised/60 shadow-card overflow-hidden">
      <div className="px-4 py-2.5">
        <span className="text-[12px] font-medium tracking-wide text-zinc-400 uppercase">Results</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-t border-white/[0.04] text-[10px] uppercase tracking-wider text-zinc-600">
              <th className="px-4 py-2 font-medium">File</th>
              <th className="px-4 py-2 font-medium text-right">Original</th>
              <th className="px-4 py-2 font-medium text-right">Compressed</th>
              <th className="px-4 py-2 font-medium text-right">Saved</th>
              <th className="px-4 py-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {finished.map((f) => (
              <tr key={f.id} className="text-zinc-300 transition-colors hover:bg-white/[0.02]">
                <td className="max-w-[180px] truncate px-4 py-2.5 font-medium" title={f.name}>
                  {f.name}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-zinc-500">
                  {fmtSize(f.size)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-zinc-500">
                  {f.compressedSize != null ? fmtSize(f.compressedSize) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono">
                  {f.status === "done" && f.compressedSize != null ? (
                    <span className="text-emerald-400">−{fmtPercent(savingsPercent(f.size, f.compressedSize))}</span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  {f.status === "done" ? (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] text-emerald-400">✓</span>
                  ) : (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/10 text-[11px] text-red-400" title={f.error}>✗</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
