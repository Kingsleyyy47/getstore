"use client";

import { useMemo, useRef, useState } from "react";
import { parseCsv, parseTxtCombo, DEFAULT_TXT_FIELD_ORDER } from "@/lib/csv";
import Modal from "@/components/Modal";

interface Template {
  id: string;
  name: string;
  bulk_format_fields: string[] | null;
  field_1_label: string | null;
  field_2_label: string | null;
}

const DEFAULT_FIELD_ORDER = ["username", "password", "two_fa", "email", "email_password", "recovery_email", "field_1", "field_2"];

interface UploadResult {
  inserted: number;
  skipped: number;
  errors: { row: number; reason: string }[];
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
  | {
      kind: "csv";
      totalRows: number;
      columns: CsvPreviewColumn[];
      sampleRows: Record<string, string>[];
      missing: string[];
      unrecognized: string[];
    }
  | {
      kind: "txt";
      totalRows: number;
      delimiterLabel: string;
      columns: TxtPreviewColumn[];
      sampleRows: Record<string, string>[];
      missing: string[];
    };

export default function BulkUploadForm({ templates }: { templates: Template[] }) {
  const [templateId, setTemplateId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);
  const activeFieldOrder =
    selectedTemplate?.bulk_format_fields && selectedTemplate.bulk_format_fields.length > 0
      ? selectedTemplate.bulk_format_fields
      : DEFAULT_FIELD_ORDER;
  const field1Label = selectedTemplate?.field_1_label || "field_1";
  const field2Label = selectedTemplate?.field_2_label || "field_2";
  const formatPreview = activeFieldOrder
    .map((f) => (f === "field_1" ? field1Label : f === "field_2" ? field2Label : f))
    .join(":");

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
  };

  function resolveCsvHeader(header: string, labels: Record<string, string>): { key: string; label: string } | null {
    switch (header.trim().toLowerCase()) {
      case "password":
        return { key: "password", label: labels.password };
      case "email":
        return { key: "email", label: labels.email };
      case "username":
        return { key: "username", label: labels.username };
      case "email_password":
        return { key: "email_password", label: labels.email_password };
      case "two_fa":
      case "two_fa_code":
        return { key: "two_fa", label: labels.two_fa };
      case "recovery_email":
        return { key: "recovery_email", label: labels.recovery_email };
      case "recovery_email_password":
        return { key: "recovery_email_password", label: labels.recovery_email_password };
      case "field_1":
      case "extra_field_1":
        return { key: "field_1", label: labels.field_1 };
      case "field_2":
      case "extra_field_2":
        return { key: "field_2", label: labels.field_2 };
      default:
        return null;
    }
  }

  // Reads the file client-side and auto-detects how it'll be parsed --
  // CSV columns mapped to known fields, or (for TXT combo lists) the
  // delimiter and positional field order -- so the admin can confirm it
  // before anything actually gets uploaded.
  async function analyzeAndOpenPreview(f: File, tmpl: Template | null = selectedTemplate) {
    setAnalyzing(true);
    setError(null);
    try {
      const text = await f.text();
      const isTxt = f.name.toLowerCase().endsWith(".txt") || f.type === "text/plain";
      const labels: Record<string, string> = {
        ...fieldLabels,
        field_1: tmpl?.field_1_label || "field_1",
        field_2: tmpl?.field_2_label || "field_2",
      };

      if (isTxt) {
        const fieldOrder =
          tmpl?.bulk_format_fields && tmpl.bulk_format_fields.length > 0
            ? tmpl.bulk_format_fields
            : DEFAULT_TXT_FIELD_ORDER;
        const rows = parseTxtCombo(text, fieldOrder);
        const lines = text
          .split(/\r\n|\r|\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        const delimiter = [":", "|", "\t"].find((d) => lines.some((l) => l.includes(d))) ?? ":";
        const delimiterLabel = delimiter === ":" ? "colon ( : )" : delimiter === "|" ? "pipe ( | )" : "tab";

        const columns: TxtPreviewColumn[] = fieldOrder.map((key) => ({
          key,
          label: labels[key] ?? key,
        }));
        const missing: string[] = [];
        if (!fieldOrder.includes("password")) missing.push("password");
        if (!fieldOrder.includes("username") && !fieldOrder.includes("email")) missing.push("username or email");

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
        const columns: CsvPreviewColumn[] = [];
        const unrecognized: string[] = [];
        const seen = new Set<string>();

        for (const h of headers) {
          const resolved = resolveCsvHeader(h, labels);
          if (resolved && !seen.has(resolved.key)) {
            columns.push({ ...resolved, header: h });
            seen.add(resolved.key);
          } else if (!resolved) {
            unrecognized.push(h);
          }
        }

        const missing: string[] = [];
        if (!seen.has("password")) missing.push("password");
        if (!seen.has("email") && !seen.has("username")) missing.push("username or email");

        setPreview({
          kind: "csv",
          totalRows: rows.length,
          columns,
          sampleRows: rows.slice(0, 3),
          missing,
          unrecognized,
        });
      }
      setPreviewOpen(true);
    } catch {
      setError("Couldn't read that file to preview it. Make sure it's a valid CSV or TXT file.");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleFile(f: File | null) {
    setFile(f);
    setResult(null);
    setPreview(null);
    if (f && templateId) analyzeAndOpenPreview(f, selectedTemplate);
  }

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    if (file) {
      const tmpl = templates.find((t) => t.id === id) ?? null;
      analyzeAndOpenPreview(file, tmpl);
    }
  }

  function requestPreview() {
    if (!templateId) {
      setError("Choose a product template first");
      return;
    }
    if (!file) {
      setError("Choose a CSV or TXT file first");
      return;
    }
    setError(null);
    if (preview) {
      setPreviewOpen(true);
    } else {
      analyzeAndOpenPreview(file);
    }
  }

  async function confirmUpload() {
    if (!templateId || !file) return;
    setPreviewOpen(false);
    setBusy(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("templateId", templateId);
    formData.append("file", file);

    const res = await fetch("/api/admin/stock/upload", { method: "POST", body: formData });
    const json = await res.json();
    setBusy(false);

    if (!res.ok && !json.inserted) {
      setError(json.error ?? "Upload failed");
      return;
    }

    setResult(json);
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2 rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-300">
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
        </div>
      )}

      <div>
        <label className="label" htmlFor="template">
          Select Product Template
        </label>
        <select
          className="input"
          id="template"
          value={templateId}
          onChange={(e) => handleTemplateChange(e.target.value)}
        >
          <option value="">Choose a product template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:p-10 ${
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
        <div className="mb-3 flex justify-center text-[var(--text-muted)]">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 16V4M6 10l6-6 6 6" />
            <path d="M4 20h16" />
          </svg>
        </div>
        <div className="font-bold">Upload CSV or TXT File</div>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          Choose a CSV or TXT file with account credentials
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,.txt,text/plain"
          className="mx-auto block text-sm text-[var(--text-muted)]"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {file && (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Selected: {file.name} {analyzing && "-- analyzing..."}
          </p>
        )}
      </div>

      <button className="btn-primary w-full" onClick={requestPreview} disabled={busy || analyzing}>
        {busy ? "Uploading..." : analyzing ? "Analyzing..." : "Preview & upload"}
      </button>

      {previewOpen && preview && (
        <Modal title="Confirm import format" onClose={() => setPreviewOpen(false)}>
          <div className="space-y-4 text-sm">
            <p className="text-[var(--text-muted)]">
              {preview.kind === "csv"
                ? "We detected this as a CSV file. Here's how each column will be read"
                : `We detected this as a TXT combo list, one account per line (delimiter: ${preview.delimiterLabel}). Here's how each field will be read`}
              {selectedTemplate ? (
                <>
                  {" "}
                  for <strong className="text-[var(--text)]">{selectedTemplate.name}</strong>
                </>
              ) : null}
              . Is this correct?
            </p>

            {preview.missing.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300">
                Missing required field{preview.missing.length > 1 ? "s" : ""}:{" "}
                {preview.missing.join(", ")}. Every row would be skipped as-is -- cancel and fix the
                file, or the{" "}
                <a href="/admin/product-templates" className="underline">
                  template's field order
                </a>
                , first.
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
                            from &quot;{c.header}&quot;
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.length === 0 && (
                    <tr>
                      <td colSpan={preview.columns.length} className="px-2 py-2 text-[var(--text-muted)]">
                        No example rows found in the file.
                      </td>
                    </tr>
                  )}
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

            {preview.kind === "csv" && preview.unrecognized.length > 0 && (
              <p className="text-xs text-[var(--text-muted)]">
                Ignoring unrecognized column{preview.unrecognized.length > 1 ? "s" : ""}:{" "}
                {preview.unrecognized.join(", ")}
              </p>
            )}

            <p className="text-xs text-[var(--text-muted)]">
              {preview.totalRows} row{preview.totalRows === 1 ? "" : "s"} detected in the file.
            </p>

            <button
              className="btn-primary w-full"
              onClick={confirmUpload}
              disabled={busy || preview.missing.length > 0}
            >
              Confirm & upload
            </button>
          </div>
        </Modal>
      )}

      <div>
        <h3 className="mb-2 text-sm font-bold">TXT Format:</h3>
        <div className="card space-y-2 p-4 text-sm">
          {selectedTemplate ? (
            <p className="text-[var(--text-muted)]">
              For <strong className="text-[var(--text)]">{selectedTemplate.name}</strong>, one account
              per line, fields separated by <code className="text-[var(--text)]">:</code>,{" "}
              <code className="text-[var(--text)]">|</code>, or a tab (auto-detected), in this order
              (set on the{" "}
              <a href="/admin/product-templates" className="underline">
                Product Templates
              </a>{" "}
              page):
            </p>
          ) : (
            <p className="text-[var(--text-muted)]">
              Choose a product template above to see its exact TXT field order — each template can
              have its own format. Default order shown below:
            </p>
          )}
          <pre className="overflow-x-auto rounded-lg bg-black/5 p-3 text-xs text-[var(--text-muted)] dark:bg-white/5">
            {formatPreview}
          </pre>
          <p className="text-[var(--text-muted)]">
            Only <code className="text-[var(--text)]">username</code> (or{" "}
            <code className="text-[var(--text)]">email</code>) and{" "}
            <code className="text-[var(--text)]">password</code> are required — leave the rest blank,
            e.g. <code className="text-[var(--text)]">user123:MyPass123</code>.
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold">CSV Format Requirements:</h3>
        <div className="card space-y-3 p-4 text-sm">
          <div>
            <div className="font-semibold">Required columns:</div>
            <ul className="mt-1 list-inside list-disc text-[var(--text-muted)]">
              <li>
                <code className="text-[var(--text)]">password</code> - Account password (required)
              </li>
              <li>
                <code className="text-[var(--text)]">email</code> OR{" "}
                <code className="text-[var(--text)]">username</code> - Account identifier (at least
                one required)
              </li>
            </ul>
          </div>
          <div>
            <div className="font-semibold">Optional columns:</div>
            <ul className="mt-1 list-inside list-disc text-[var(--text-muted)]">
              <li>
                <code className="text-[var(--text)]">email_password</code> - Email account password
              </li>
              <li>
                <code className="text-[var(--text)]">two_fa</code> or{" "}
                <code className="text-[var(--text)]">two_fa_code</code> - Two-factor authentication
                code
              </li>
              <li>
                <code className="text-[var(--text)]">recovery_email</code> - Recovery email address
              </li>
              <li>
                <code className="text-[var(--text)]">recovery_email_password</code> - Recovery email
                password
              </li>
              <li>
                <code className="text-[var(--text)]">username</code> - Account username (if email is
                primary identifier)
              </li>
              <li>
                <code className="text-[var(--text)]">field_1</code>,{" "}
                <code className="text-[var(--text)]">field_2</code> - Free-form extra info (PIN,
                linked phone number, backup codes, etc.)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
