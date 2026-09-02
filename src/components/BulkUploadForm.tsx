"use client";

import { useMemo, useRef, useState } from "react";

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

export default function BulkUploadForm({ templates }: { templates: Template[] }) {
  const [templateId, setTemplateId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
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

  async function upload() {
    if (!templateId) {
      setError("Choose a product template first");
      return;
    }
    if (!file) {
      setError("Choose a CSV or TXT file first");
      return;
    }

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
          onChange={(e) => setTemplateId(e.target.value)}
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
          if (dropped) setFile(dropped);
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
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file && <p className="mt-2 text-sm text-[var(--text-muted)]">Selected: {file.name}</p>}
      </div>

      <button className="btn-primary w-full" onClick={upload} disabled={busy}>
        {busy ? "Uploading..." : "Upload accounts"}
      </button>

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
