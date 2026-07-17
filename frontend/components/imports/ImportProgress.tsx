"use client";

import { getImportProgressPercent, ImportProgressState } from "./importUtils";

export function ImportProgress({
  progress,
}: {
  progress: ImportProgressState;
}) {
  const percent = getImportProgressPercent(progress);

  return (
    <div className="rounded-3xl border border-border/70 bg-background p-4 shadow-sm shadow-slate-900/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
            Import progress
          </p>
          <div className="mt-2 flex items-end gap-3">
            <p className="text-3xl font-black text-foreground">{percent}%</p>
            <p className="text-sm leading-5 text-muted-foreground">
              {progress.rowsDone} of {progress.totalRows} rows
            </p>
          </div>
        </div>
        <div className="rounded-full border border-border/60 bg-background/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {progress.batchIndex} of {progress.batchTotal} batches
        </div>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-foreground/40">
        <div
          className="h-full rounded-full bg-linear-to-r from-warning/60 via-primary/70 to-success/70 transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Sending validated rows in optimized payloads. The percentage updates as
        each upload batch begins.
      </p>
    </div>
  );
}
