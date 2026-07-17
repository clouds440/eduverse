"use client";

import { ImportConfirmResult, ImportPreviewRow } from "@/types";

export const IMPORT_CONFIRM_BATCH_SIZE = 100;

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
  percent: number;
}

export function chunkImportRows<T>(
  rows: ImportPreviewRow<T>[],
  batchSize = IMPORT_CONFIRM_BATCH_SIZE,
) {
  const chunks: ImportPreviewRow<T>[][] = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    chunks.push(rows.slice(index, index + batchSize));
  }
  return chunks;
}

export function initImportProgress(): ImportProgressState {
  return { percent: 0 };
}

export function setImportProgressPercent(percent: number): ImportProgressState {
  return {
    percent: Math.max(0, Math.min(100, Math.round(percent))),
  };
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
