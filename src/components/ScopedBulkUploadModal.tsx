"use client";

import { useRef, useState } from "react";
import Modal from "@/components/Modal";
import {
  parseCsv,
  parseTxtCombo,
  DEFAULT_TXT_FIELD_ORDER,
  resolveCsvColumns,
  resolveTxtFieldOrder,
  promoteTxtLinkField,
} from "@/lib/csv";

interface Template {
  id: string;
  name: string;
  bulkFormatFields: string[] | null;
  field1Label: string | null;
  field2Label: string | null;
}

interface StoredSampleRow {
  username: string | null;
  email: string | null;
  password: string | null;
  two_fa: string | null;
  email_password: string | null;
  recovery_email: string | null;
  recovery_email_password: string | null;
  extra_field_1: string | null;
  extra_field_2: string | null;
  link: string | null;
}

interface UploadResult {
  inserted: number;
  skipped: number;
  errors: { row: number; reason: string }[];
  sample?: StoredSampleRow[];
}

interface CsvPreviewColumn {
  key: string;
  label: string;
  header: string;
}
interface TxtPreviewColumn {
  key: string;
  label: string;
}

type Preview =
  | { kind: "csv"; totalRows: number; columns: CsvPreviewColumn[]; sampleRows: Record<string, string>[]; missing: string[]; unrecognized: string[] }
  | { kind: "txt"; totalRows: number; delimiterLabel: string; columns: TxtPreviewColumn[]; sampleRows: Record<string, string>[]; missing: string[] };

/**
 * "Add Logs" on a template's 3-dot menu -- the same CSV/TXT bulk upload as
 * the older standalone Bulk Upload page (src/components/BulkUploadForm.tsx),
 * just pre-scoped to this one template instead of asking the admin to pick
 * one from a dropdown. Runs as a single modal with an internal step switch
 * (pick file -> confirm preview) rather than a nested modal-in-modal.
 */
export default function ScopedBulkUploadModal({
  template,
  onClose,
  onDone,
}: {
  template: Template;
  onClose: () => void;
  onDone: (result: UploadResult) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const configuredFieldOrder =
    template.bulkFormatFields && template.bulkFormatFields.length > 0
      ? template.bulkFormatFields
      : DEFAULT_TXT_FIELD_ORDER;
  const field1Label = template.field1Label || "field_1";
  const field2Label = template.field2Label || "field_2";

  // What the post-upload "as stored" sample shows -- the actual DB row,
  // not the client-side parse guess, so the admin can confirm the real
  // columns landed right. extra_field_1 uses the template's own custom
  // label (e.g. "Cookie section") when one's set.
  const sampleColumns: { key: keyof StoredSampleRow; label: string }[] = [
    { key: "username", label: "Username" },
    { key: "email", label: "Email" },
    { key: "password", label: "Password" },
    { key: "two_fa", label: "2FA code" },
    { key: "email_password", label: "Email password" },
    { key: "recovery_email", label: "Recovery email" },
    { key: "extra_field_1", label: field1Label },
    { key: "link", label: "Link" },
  ];

  const fieldLabels: Record<string, string> = {
    username: "Username",
    password: "Password",
    email: "Email",
    email_password: "Email password",
    two_fa: "2FA code",
    recovery_email: "Recovery email",
    recovery_email_password: "Recovery email password",
    field_1: field1Label,
    field_2: field2Label,
    link: "Link",
  };

  async function analyzeAndPreview(f: File) {
    setAnalyzing(true);
    setError(null);
    try {
      const text = await f.text();
      const isTxt = f.name.toLowerCase().endsWith(".txt") || f.type === "text/plain";

      if (isTxt) {
        // A short combo list's actual column count overrides the
        // configured order (1 column = link, 2 = username:password, 3 =
        // username:password:2fa) -- see resolveTxtFieldOrder.
        const activeFieldOrder = resolveTxtFieldOrder(text, configuredFieldOrder);
        const rawRows = parseTxtCombo(text, activeFieldOrder);
        const { rows, fieldOrder } = promoteTxtLinkField(rawRows, activeFieldOrder);
        const lines = text
          .split(/\r\n|\r|\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        const delimiter = [":", "|", "\t"].find((d) => lines.some((l) => l.includes(d))) ?? ":";
        const delimiterLabel = delimiter === ":" ? "colon ( : )" : delimiter === "|" ? "pipe ( | )" : "tab";

        const columns: TxtPreviewColumn[] = fieldOrder.map((key) => ({ key, label: fieldLabels[key] ?? key }));
        // A link-only format (see above) has nothing else required.
        const missing: string[] = [];
        if (!fieldOrder.includes("link")) {
          if (!fieldOrder.includes("password")) missing.push("password");
          if (!fieldOrder.includes("username") && !fieldOrder.includes("email")) missing.push("username or email");
        }

        setPreview({
          kind: "txt",
          totalRows: rows.length,
          delimiterLabel,
          columns,
          sampleRows: rows.slice(0, 3),
          missing,
        });
      } else {
        const rows = parseCsv(text);
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        const { columns: resolved, unrecognized } = resolveCsvColumns(headers, rows);
        const columns: CsvPreviewColumn[] = resolved.map((c) => {
          if (c.key === "field_1" && template.field1Label) return { ...c, label: template.field1Label };
          if (c.key === "field_2" && template.field2Label) return { ...c, label: template.field2Label };
          return c;
        });
        const seen = new Set(columns.map((c) => c.key));
        // A link-only format (single unlabeled column) has nothing else
        // required.
        const missing: string[] = [];
        if (!seen.has("link")) {
          if (!seen.has("password")) missing.push("password");
          if (!seen.has("email") && !seen.has("username")) missing.push("username or email");
        }

        setPreview({ kind: "csv", totalRows: rows.length, columns, sampleRows: rows.slice(0, 3), missing, unrecognized });
      }
    } catch {
      setError("Couldn't read that file. Make sure it's a valid CSV or TXT file.");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleFile(f: File | null) {
    setFile(f);
    setResult(null);
    setPreview(null);
    setError(null);
    if (f) analyzeAndPreview(f);
  }

  async function confirmUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);

    const formData = new FormData();
    formData.append("templateId", template.id);
    formData.append("file", file);

    const res = await fetch("/api/admin/stock/upload", { method: "POST", body: formData });
    const json = await res.json();
    setBusy(false);

    if (!res.ok && !json.inserted) {
      setError(json.error ?? "Upload failed");
      return;
    }

    setResult(json);
    setPreview(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    onDone(json);
  }

  return (
    <Modal title={`Add logs — ${template.name}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>
        )}

        {result && (
          <div className="space-y-3 rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-teal-300">
            <div>
              Uploaded {result.inserted} account{result.inserted === 1 ? "" : "s"}
              {result.skipped > 0 && `, skipped ${result.skipped} invalid row${result.skipped === 1 ? "" : "s"}`}.
            </div>
            {result.errors.length > 0 && (
              <ul className="list-inside list-disc text-teal-200/80">
                {result.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.reason}
                  </li>
                ))}
                {result.errors.length > 10 && <li>...and {result.errors.length - 10} more</li>}
              </ul>
            )}

            {result.sample && result.sample.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-teal-200/80">
                  As stored (first {result.sample.length})
                </div>
                <div className="overflow-x-auto rounded-lg border border-teal-500/20">
                  <table className="w-full text-left text-xs text-[var(--text)]">
                    <thead className="bg-black/10">
                      <tr>
                        {sampleColumns.map((c) => (
                          <th key={c.key} className="px-2 py-1.5 font-semibold">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.sample.map((row, i) => (
                        <tr key={i} className="border-t border-teal-500/20">
                          {sampleColumns.map((c) => (
                            <td key={c.key} className="max-w-[10rem] truncate px-2 py-1.5">
                              {row[c.key] || <span className="text-[var(--text-muted)]">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button className="btn-primary mt-2 w-full" type="button" onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {!result && !preview && (
          <>
            <div
              className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                dragOver ? "border-brand bg-brand/5" : "border-[var(--border)]"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) handleFile(dropped);
              }}
            >
              <div className="font-bold">Upload CSV or TXT file</div>
              <p className="mb-3 text-xs text-[var(--text-muted)]">
                Account credentials for {template.name}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv,.txt,text/plain"
                className="mx-auto block text-xs text-[var(--text-muted)]"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              {file && analyzing && <p className="mt-2 text-xs text-[var(--text-muted)]">Analyzing...</p>}
            </div>
          </>
        )}

        {!result && preview && (
          <div className="space-y-4">
            <p className="text-[var(--text-muted)]">
              {preview.kind === "csv"
                ? "Detected as CSV. Here's how each column will be read:"
                : `Detected as a TXT combo list, one account per line (delimiter: ${preview.delimiterLabel}):`}
            </p>

            {preview.missing.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300">
                Missing required field{preview.missing.length > 1 ? "s" : ""}: {preview.missing.join(", ")}.
                Every row would be skipped as-is.
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/5 dark:bg-white/5">
                  <tr>
                    {preview.columns.map((c) => (
                      <th key={c.key} className="px-2 py-1.5 font-semibold">
                        {c.label}
                        {preview.kind === "csv" && (
                          <div className="font-normal text-[10px] text-[var(--text-muted)]">
                            from &quot;{(c as CsvPreviewColumn).header}&quot;
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.map((row, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      {preview.columns.map((c) => {
                        const value = preview.kind === "csv" ? row[(c as CsvPreviewColumn).header] : row[c.key];
                        return (
                          <td key={c.key} className="px-2 py-1.5">
                            {value || <span className="text-[var(--text-muted)]">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              {preview.totalRows} row{preview.totalRows === 1 ? "" : "s"} detected.
            </p>

            <div className="flex gap-2">
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Choose a different file
              </button>
              <button
                className="btn-primary flex-1"
                type="button"
                onClick={confirmUpload}
                disabled={busy || preview.missing.length > 0}
              >
                {busy ? "Uploading..." : "Confirm & upload"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
