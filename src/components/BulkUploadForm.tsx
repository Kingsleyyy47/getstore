"use client";

import { useMemo, useRef, useState } from "react";
import {
  parseCsv,
  parseTxtCombo,
  DEFAULT_TXT_FIELD_ORDER,
  resolveCsvColumns,
  resolveTxtFieldOrder,
  promoteTxtLinkField,
} from "@/lib/csv";
import Modal from "@/components/Modal";

interface Template {
  id: string;
  name: string;
  bulk_format_fields: string[] | null;
  field_1_label: string | null;
  field_2_label: string | null;
}

const DEFAULT_FIELD_ORDER = ["username", "password", "two_fa", "email", "email_password", "recovery_email", "field_1", "field_2"];

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
    link: "Link",
  };

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

  // Reads the file client-side and auto-detects how it'll be parsed --
  // CSV columns mapped to known fields (auto-detecting anything else,
  // including a link column, instead of assuming a fixed category's field
  // set -- see resolveCsvColumns in src/lib/csv.ts), or (for TXT combo
  // lists) the delimiter and positional field order -- so the admin can
  // confirm it before anything actually gets uploaded.
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
        const configuredFieldOrder =
          tmpl?.bulk_format_fields && tmpl.bulk_format_fields.length > 0
            ? tmpl.bulk_format_fields
            : DEFAULT_TXT_FIELD_ORDER;
        // A short combo list's actual column count overrides the
        // configured order (1 column = link, 2 = username:password, 3 =
        // username:password:2fa) -- see resolveTxtFieldOrder.
        const rawFieldOrder = resolveTxtFieldOrder(text, configuredFieldOrder);
        const rawRows = parseTxtCombo(text, rawFieldOrder);
        const { rows, fieldOrder } = promoteTxtLinkField(rawRows, rawFieldOrder);
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
        // A link-only format (see above) has nothing else required -- the
        // link itself is the whole credential.
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

        // Known field_1/field_2 slots use the admin's configured label for
        // that template when set (e.g. "Year"); an auto-detected column
        // (one that wasn't literally named "field_1"/"field_2") keeps the
        // label taken from the file's own header text instead, since
        // that's more informative than a generic slot name.
        const columns: CsvPreviewColumn[] = resolved.map((c) => {
          if (c.key === "field_1" && tmpl?.field_1_label) return { ...c, label: tmpl.field_1_label };
          if (c.key === "field_2" && tmpl?.field_2_label) return { ...c, label: tmpl.field_2_label };
          return c;
        });
        const seen = new Set(columns.map((c) => c.key));

        // A link-only format (single unlabeled column -- see
        // resolveCsvColumns) has nothing else required.
        const missing: string[] = [];
        if (!seen.has("link")) {
          if (!seen.has("password")) missing.push("password");
          if (!seen.has("email") && !seen.has("username")) missing.push("username or email");
        }

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
        <div className="space-y-3 rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-300">
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
                            from &quot;{(c as CsvPreviewColumn).header}&quot;
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
          <p className="text-[var(--text-muted)]">
            The file&apos;s own column count overrides this for short lists, regardless of the
            template&apos;s configured order above: a file with just{" "}
            <strong className="text-[var(--text)]">one</strong> column per line is treated as a plain
            list of login links, <strong className="text-[var(--text)]">two</strong> columns as{" "}
            <code className="text-[var(--text)]">username:password</code>, and{" "}
            <strong className="text-[var(--text)]">three</strong> as{" "}
            <code className="text-[var(--text)]">username:password:2fa</code>.
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
                <code className="text-[var(--text)]">link</code> or{" "}
                <code className="text-[var(--text)]">url</code> - A login link, auto-detected and
                shown to the buyer as a clickable link
              </li>
              <li>
                <code className="text-[var(--text)]">field_1</code>,{" "}
                <code className="text-[var(--text)]">field_2</code> - Free-form extra info (PIN,
                linked phone number, backup codes, a cookie, etc.)
              </li>
            </ul>
            <p className="mt-2 text-[var(--text-muted)]">
              Any other column name is fine too — it's read automatically, no fixed set of columns
              or product category required. If its values are all real links they're treated as the{" "}
              <code className="text-[var(--text)]">link</code> field even without that exact header
              name; otherwise it fills the next open extra-info slot labeled with its own column
              name. The same auto-detection applies to a TXT combo list's extra positions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
