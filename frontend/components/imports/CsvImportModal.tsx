"use client";

import { useMemo, useState } from "react";
import { mutate } from "swr";
import { Download, FileUp, UploadCloud } from "lucide-react";
import { api } from "@/lib/api";
import { CacheKeyPrefix, matchesCacheKeyPrefix } from "@/lib/swr";
import {
  ImportConfirmResult,
  ImportEntity,
  ImportValidationResult,
  InvalidImportRow,
} from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useGlobal } from "@/context/GlobalContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { StatusBanner } from "@/components/ui/StatusBanner";
import {
  chunkImportRows,
  downloadCsv,
  formatImportErrors,
  initImportProgress,
  ImportProgressState,
  mergeImportConfirmResults,
  setImportProgressPercent,
} from "./importUtils";
import { ImportProgress } from "./ImportProgress";

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: ImportEntity;
  title: string;
  cachePrefix: CacheKeyPrefix | CacheKeyPrefix[];
}

export function CsvImportModal({
  isOpen,
  onClose,
  entity,
  title,
  cachePrefix,
}: CsvImportModalProps) {
  const { token } = useAuth();
  const { dispatch } = useGlobal();
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ImportValidationResult | null>(
    null,
  );
  const [result, setResult] = useState<ImportConfirmResult | null>(null);
  const [activeAction, setActiveAction] = useState<
    "template" | "structure" | "validate" | "confirm" | "issues" | null
  >(null);
  const [confirmProgress, setConfirmProgress] =
    useState<ImportProgressState | null>(null);

  const busy = activeAction !== null;
  const isConfirming = activeAction === "confirm";
  const warningRows: InvalidImportRow[] = (validation?.validRows || [])
    .filter((row) => row.warnings?.length)
    .map((row) => ({
      rowNumber: row.rowNumber,
      raw: row.raw,
      errors: row.warnings || [],
    }));
  const invalidRows = result?.errors || validation?.invalidRows || [];
  const canConfirm = Boolean(validation?.validRows.length && !result);
  const cachePrefixes = useMemo(
    () => (Array.isArray(cachePrefix) ? cachePrefix : [cachePrefix]),
    [cachePrefix],
  );
  const importHint =
    entity === "rooms"
      ? "Rooms use buildingCode, room code, required floor, optional landmark and directions fields. Do not paste database IDs."
      : entity === "buildings"
        ? "Buildings use building code and optional departmentCodes, landmark, directions, sort order, and reserved map fields."
        : entity === "cohorts"
          ? "Cohort CSV imports create empty cohorts only. Add students and sections manually after import; academicCycleCode is resolved from the academic cycle code."
          : entity === "guardians"
            ? 'Guardians can use linkedStudents to link one or more students by registration number. Example: "REG-001,REG-002". These links use the guardian-student relationship table and can always be linked or unlinked later.'
            : entity === "schedules"
              ? 'Use sectionCode. day accepts Mon-Sun, "Mon,Tue", weekdays, or weekends; leave day blank when date is set. Optional roomCode overrides the section default room.'
              : null;
  const importHintAction =
    entity === "schedules"
      ? { label: "Schedule docs", href: "/docs/timetable#schedule-teacher" }
      : undefined;

  const handleDownloadTemplate = async () => {
    if (!token) return;
    setActiveAction("template");
    try {
      const csv = await api.imports.getTemplate(entity, token);
      downloadCsv(`${entity}-template.csv`, csv);
    } catch (error) {
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message:
            error instanceof Error
              ? error.message
              : "Unable to download template",
          type: "error",
        },
      });
    } finally {
      setActiveAction(null);
    }
  };

  const handleDownloadStructure = async () => {
    if (!token) return;
    setActiveAction("structure");
    try {
      const csv = await api.imports.getStructure(entity, token);
      downloadCsv(`${entity}-structure.csv`, csv);
    } catch (error) {
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message:
            error instanceof Error
              ? error.message
              : "Unable to download structure",
          type: "error",
        },
      });
    } finally {
      setActiveAction(null);
    }
  };

  const handleValidate = async () => {
    if (!token || !file) return;
    setActiveAction("validate");
    setResult(null);
    try {
      const response = await api.imports.validate(entity, file, token);
      setValidation(response);
    } catch (error) {
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message:
            error instanceof Error ? error.message : "Unable to validate CSV",
          type: "error",
        },
      });
    } finally {
      setActiveAction(null);
    }
  };

  const handleConfirm = async () => {
    if (!token || !validation) return;
    setActiveAction("confirm");
    setConfirmProgress(null);
    const batchResults: ImportConfirmResult[] = [];
    try {
      const batches = chunkImportRows(validation.validRows);
      let processedOffset = 0;
      setConfirmProgress(initImportProgress());
      for (const batch of batches) {
        const batchResult = await api.imports.confirmStream(
          entity,
          batch,
          token,
          {
            totalRows: validation.validRows.length,
            processedOffset,
          },
          {
            onProgress: (percent) =>
              setConfirmProgress(setImportProgressPercent(percent)),
          },
        );
        batchResults.push(batchResult);
        processedOffset += batch.length;
      }
      const response = mergeImportConfirmResults(entity, batchResults);
      setResult(response);
      cachePrefixes.forEach((prefix) => mutate(matchesCacheKeyPrefix(prefix)));
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message: `Imported ${response.importedCount} row${response.importedCount === 1 ? "" : "s"}`,
          type: "success",
        },
      });
    } catch (error) {
      if (batchResults.length) {
        const partial = mergeImportConfirmResults(entity, batchResults);
        setResult(partial);
        cachePrefixes.forEach((prefix) =>
          mutate(matchesCacheKeyPrefix(prefix)),
        );
        dispatch({
          type: "TOAST_ADD",
          payload: {
            message: `Imported ${partial.importedCount} rows before the import stopped`,
            type: "info",
          },
        });
      }
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message:
            error instanceof Error ? error.message : "Unable to import rows",
          type: "error",
        },
      });
    } finally {
      setConfirmProgress(null);
      setActiveAction(null);
    }
  };

  const handleDownloadErrors = async () => {
    if (!token || invalidRows.length === 0) return;
    setActiveAction("issues");
    try {
      const csv = await api.imports.getErrorReport(entity, invalidRows, token);
      downloadCsv(`${entity}-import-errors.csv`, csv);
    } catch (error) {
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message:
            error instanceof Error
              ? error.message
              : "Unable to download error CSV",
          type: "error",
        },
      });
    } finally {
      setActiveAction(null);
    }
  };

  const resetAndClose = () => {
    if (isConfirming) return;
    setFile(null);
    setValidation(null);
    setResult(null);
    setConfirmProgress(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title={`Import ${title}`}
      subtitle="Download the example template or DB-filled structure, validate your CSV, then confirm valid rows. Limit: 1k rows per CSV."
      maxWidth="max-w-5xl"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              icon={Download}
              onClick={handleDownloadTemplate}
              disabled={busy}
              isLoading={activeAction === "template"}
            >
              Template
            </Button>
            <Button
              type="button"
              variant="outline"
              icon={Download}
              onClick={handleDownloadStructure}
              disabled={busy}
              isLoading={activeAction === "structure"}
            >
              Structure
            </Button>
          </div>
          <div className="flex gap-2">
            {invalidRows.length > 0 && (
              <Button
                type="button"
                variant="outline"
                icon={Download}
                onClick={handleDownloadErrors}
                disabled={busy}
                isLoading={activeAction === "issues"}
              >
                Error CSV
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={resetAndClose}
              disabled={busy}
            >
              Close
            </Button>
            <Button
              type="button"
              icon={UploadCloud}
              onClick={handleConfirm}
              disabled={!canConfirm || busy}
              isLoading={activeAction === "confirm"}
            >
              Import Valid Rows
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {confirmProgress && <ImportProgress progress={confirmProgress} />}
        {importHint && (
          <StatusBanner
            title="Template note"
            variant="info"
            description={importHint}
            action={importHintAction}
          />
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setValidation(null);
              setResult(null);
            }}
          />
          <Button
            type="button"
            icon={FileUp}
            onClick={handleValidate}
            disabled={!file || busy}
            isLoading={activeAction === "validate"}
          >
            Validate
          </Button>
        </div>

        {validation && (
          <div className="grid gap-2 sm:grid-cols-5">
            <Metric
              label="Valid"
              value={
                validation.summary.valid - (validation.summary.partial || 0)
              }
              variant="success"
            />
            <Metric
              label="Partial"
              value={validation.summary.partial || 0}
              variant="warning"
            />
            <Metric
              label="Invalid"
              value={validation.summary.invalid}
              variant="danger"
            />
            <Metric
              label="Duplicates"
              value={validation.summary.duplicate}
              variant="warning"
            />
            <Metric
              label="Rows"
              value={validation.totalRows}
              variant="neutral"
            />
          </div>
        )}

        {result && (
          <StatusBanner
            title="Import finished"
            variant={result.failedCount ? "warning" : "success"}
            description={`Imported ${result.importedCount}, skipped ${result.skippedCount}, failed ${result.failedCount}, duplicates ${result.duplicateCount}.`}
          />
        )}

        {validation && validation.validRows.length > 0 && !result && (
          <PreviewTable
            title="Valid rows"
            rows={validation.validRows
              .filter((row) => !row.warnings?.length)
              .map((row) => ({
                rowNumber: row.rowNumber,
                detail: Object.values(row.raw)
                  .filter(Boolean)
                  .slice(0, 4)
                  .join(" | "),
              }))}
          />
        )}

        {warningRows.length > 0 && (
          <PreviewTable
            title="Partially valid rows"
            rows={warningRows.map((row) => ({
              rowNumber: row.rowNumber,
              detail: formatImportErrors(row.errors),
            }))}
            warning
          />
        )}

        {invalidRows.length > 0 && (
          <PreviewTable
            title="Invalid or failed rows"
            rows={invalidRows.map((row: InvalidImportRow) => ({
              rowNumber: row.rowNumber,
              detail: formatImportErrors(row.errors),
            }))}
            danger
          />
        )}
      </div>
    </Modal>
  );
}

function Metric({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "success" | "danger" | "warning" | "neutral";
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/60 p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-center justify-between">
        <p className="font-mono text-xl font-black text-foreground">{value}</p>
        <Badge variant={variant === "danger" ? "error" : variant} size="sm">
          {label}
        </Badge>
      </div>
    </div>
  );
}

function PreviewTable({
  title,
  rows,
  danger,
  warning,
}: {
  title: string;
  rows: { rowNumber: number; detail: string }[];
  danger?: boolean;
  warning?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-lg border border-border/70">
      <div className="border-b border-border/70 bg-background px-3 py-2">
        <h3 className="text-sm font-black text-foreground">{title}</h3>
      </div>
      <div className="max-h-64 overflow-auto custom-scrollbar">
        <table className="w-full text-left text-sm">
          <tbody>
            {rows.slice(0, 100).map((row) => (
              <tr
                key={`${title}-${row.rowNumber}`}
                className="border-b border-border/50 last:border-b-0"
              >
                <td className="w-24 px-3 py-2 font-mono text-xs font-black text-muted-foreground">
                  Row {row.rowNumber}
                </td>
                <td
                  className={`px-3 py-2 text-xs font-semibold ${danger ? "text-danger" : warning ? "text-warning" : "text-foreground/80"}`}
                >
                  {row.detail || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
