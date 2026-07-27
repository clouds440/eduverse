"use client";

import { ImportConfirmResult } from "@/types";

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function formatImportErrors(
  errors: { field?: string; message: string }[],
) {
  return errors
    .map((error) =>
      error.field ? `${error.field}: ${error.message}` : error.message,
    )
    .join("; ");
}

export interface ImportProgressState {
  percent: number | null;
  label: string;
}

export function initImportProgress(): ImportProgressState {
  return { percent: null, label: "Preparing..." };
}

export function setImportProgressPercent(percent: number): ImportProgressState {
  return {
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    label: percent >= 100 ? "Finishing..." : "Importing your file",
  };
}

export function waitForProgressCompletion() {
  return new Promise<void>((resolve) => setTimeout(resolve, 350));
}

export function mergeImportConfirmResults(
  entity: string,
  results: ImportConfirmResult[],
): ImportConfirmResult {
  return results.reduce<ImportConfirmResult>(
    (merged, result) => ({
      entity,
      importedCount: merged.importedCount + result.importedCount,
      skippedCount: merged.skippedCount + result.skippedCount,
      failedCount: merged.failedCount + result.failedCount,
      duplicateCount: merged.duplicateCount + result.duplicateCount,
      errors: [...merged.errors, ...(result.errors || [])],
    }),
    {
      entity,
      importedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      duplicateCount: 0,
      errors: [],
    },
  );
}
