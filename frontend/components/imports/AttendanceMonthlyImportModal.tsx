"use client";

import { useMemo, useState } from "react";
import { mutate } from "swr";
import { CalendarDays, Download, FileUp, UploadCloud } from "lucide-react";
import { api } from "@/lib/api";
import { matchesCacheKeyPrefixStartsWith } from "@/lib/swr";
import {
  AttendanceImportTargetMode,
  ImportConfirmResult,
  ImportValidationResult,
  InvalidImportRow,
} from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useGlobal } from "@/context/GlobalContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { StatusBanner } from "@/components/ui/StatusBanner";
import {
  chunkImportRows,
  downloadCsv,
  formatImportErrors,
  initImportProgress,
  mergeImportConfirmResults,
  ImportProgressState,
  setImportProgressPercent,
} from "./importUtils";
import { ImportProgress } from "./ImportProgress";

const TARGET_OPTIONS: { value: AttendanceImportTargetMode; label: string }[] = [
  { value: "FIRST_SCHEDULE", label: "First scheduled session" },
  { value: "ALL_SCHEDULES", label: "All scheduled sessions" },
];

export function AttendanceMonthlyImportModal({
  isOpen,
  onClose,
  sectionId,
  initialYear,
  initialMonth,
}: {
  isOpen: boolean;
  onClose: () => void;
  sectionId: string;
  initialYear: number;
  initialMonth: number;
}) {
  const { token } = useAuth();
  const { dispatch } = useGlobal();
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [targetMode, setTargetMode] =
    useState<AttendanceImportTargetMode>("FIRST_SCHEDULE");
  const [validation, setValidation] = useState<ImportValidationResult | null>(
    null,
  );
  const [result, setResult] = useState<ImportConfirmResult | null>(null);
  const [activeAction, setActiveAction] = useState<
    "template" | "validate" | "confirm" | "errors" | null
  >(null);
  const [confirmProgress, setConfirmProgress] =
    useState<ImportProgressState | null>(null);
  const busy = activeAction !== null;
  const isConfirming = activeAction === "confirm";
  const invalidRows = result?.errors || validation?.invalidRows || [];
  const options = useMemo(
    () => ({ sectionId, year, month, targetMode }),
    [month, sectionId, targetMode, year],
  );

  const handleTemplate = async () => {
    if (!token) return;
    setActiveAction("template");
    try {
      const csv = await api.imports.getAttendanceMonthlyTemplate(
        { sectionId, year, month },
        token,
      );
      downloadCsv(
        `attendance-${year}-${String(month).padStart(2, "0")}.csv`,
        csv,
      );
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

  const handleValidate = async () => {
    if (!token || !file) return;
    setActiveAction("validate");
    setResult(null);
    try {
      setValidation(
        await api.imports.validateAttendanceMonthly(options, file, token),
      );
    } catch (error) {
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message:
            error instanceof Error
              ? error.message
              : "Unable to validate attendance CSV",
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
        const batchResult = await api.imports.confirmAttendanceMonthlyStream(
          options,
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
      const response = mergeImportConfirmResults(
        "attendance-monthly",
        batchResults,
      );
      setResult(response);
      mutate(matchesCacheKeyPrefixStartsWith("attendance-"));
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message: `Imported ${response.importedCount} attendance mark${response.importedCount === 1 ? "" : "s"}`,
          type: "success",
        },
      });
    } catch (error) {
      if (batchResults.length) {
        const partial = mergeImportConfirmResults(
          "attendance-monthly",
          batchResults,
        );
        setResult(partial);
        mutate(matchesCacheKeyPrefixStartsWith("attendance-"));
        dispatch({
          type: "TOAST_ADD",
          payload: {
            message: `Imported ${partial.importedCount} marks before the import stopped`,
            type: "info",
          },
        });
      }
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message:
            error instanceof Error
              ? error.message
              : "Unable to import attendance",
          type: "error",
        },
      });
    } finally {
      setConfirmProgress(null);
      setActiveAction(null);
    }
  };

  const handleErrors = async () => {
    if (!token || invalidRows.length === 0) return;
    setActiveAction("errors");
    try {
      const csv = await api.imports.getAttendanceMonthlyErrorReport(
        year,
        month,
        invalidRows,
        token,
      );
      downloadCsv(
        `attendance-errors-${year}-${String(month).padStart(2, "0")}.csv`,
        csv,
      );
    } catch (error) {
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message:
            error instanceof Error
              ? error.message
              : "Unable to download errors",
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
      title="Import Monthly Attendance"
      subtitle="Use name, rollNumber, and day columns with P, A, L, E values. Limit: 1k rows per CSV."
      maxWidth="max-w-5xl"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            icon={Download}
            onClick={handleTemplate}
            disabled={busy}
            isLoading={activeAction === "template"}
          >
            Template
          </Button>
          <div className="flex gap-2">
            {invalidRows.length > 0 && (
              <Button
                type="button"
                variant="outline"
                icon={Download}
                onClick={handleErrors}
                disabled={busy}
                isLoading={activeAction === "errors"}
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
              disabled={!validation?.validRows.length || !!result || busy}
              isLoading={activeAction === "confirm"}
            >
              Import Marks
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {confirmProgress && <ImportProgress progress={confirmProgress} />}
        <div className="grid gap-3 sm:grid-cols-[150px_150px_1fr]">
          <div className="space-y-2">
            <Label>Year</Label>
            <Input
              type="number"
              value={year}
              disabled={busy}
              onChange={(event) => {
                setYear(Number(event.target.value));
                setValidation(null);
                setResult(null);
              }}
              icon={CalendarDays}
            />
          </div>
          <div className="space-y-2">
            <Label>Month</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={month}
              disabled={busy}
              onChange={(event) => {
                setMonth(Number(event.target.value));
                setValidation(null);
                setResult(null);
              }}
              icon={CalendarDays}
            />
          </div>
          <div className="space-y-2">
            <Label>Target</Label>
            <CustomSelect
              value={targetMode}
              onChange={(value) => {
                setTargetMode(value as AttendanceImportTargetMode);
                setValidation(null);
                setResult(null);
              }}
              options={TARGET_OPTIONS}
              disabled={busy}
            />
          </div>
        </div>
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
          <div className="grid gap-2 sm:grid-cols-4">
            <Metric label="Valid rows" value={validation.summary.valid} />
            <Metric label="Invalid rows" value={validation.summary.invalid} />
            <Metric label="Duplicates" value={validation.summary.duplicate} />
            <Metric label="Blank cells" value={validation.summary.skipped} />
          </div>
        )}
        {result && (
          <StatusBanner
            title="Attendance import finished"
            variant={result.failedCount ? "warning" : "success"}
            description={`Imported ${result.importedCount} marks, skipped ${result.skippedCount}, failed ${result.failedCount}, duplicates ${result.duplicateCount}.`}
          />
        )}
        {validation?.validRows.length ? (
          <Preview
            title="Valid rows"
            rows={validation.validRows.map((row) => ({
              rowNumber: row.rowNumber,
              detail: `${row.raw.name || ""} (${row.raw.rollNumber || ""})`,
            }))}
          />
        ) : null}
        {invalidRows.length > 0 && (
          <Preview
            danger
            title="Invalid or failed rows"
            rows={invalidRows.map((row: InvalidImportRow) => ({
              rowNumber: row.rowNumber,
              detail: formatImportErrors(row.errors),
            }))}
          />
        )}
      </div>
    </Modal>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/60 p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-black text-foreground">
        {value}
      </p>
    </div>
  );
}

function Preview({
  title,
  rows,
  danger,
}: {
  title: string;
  rows: { rowNumber: number; detail: string }[];
  danger?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border/70">
      <div className="border-b border-border/70 bg-background px-3 py-2">
        <h3 className="text-sm font-black text-foreground">{title}</h3>
      </div>
      <div className="max-h-64 overflow-auto custom-scrollbar">
        {rows.slice(0, 120).map((row) => (
          <div
            key={`${title}-${row.rowNumber}`}
            className="grid grid-cols-[90px_1fr] border-b border-border/50 px-3 py-2 text-xs last:border-b-0"
          >
            <span className="font-mono font-black text-muted-foreground">
              Row {row.rowNumber}
            </span>
            <span
              className={
                danger
                  ? "font-semibold text-danger"
                  : "font-semibold text-foreground/80"
              }
            >
              {row.detail || "-"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
