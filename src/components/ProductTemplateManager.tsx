"use client";

import { useState } from "react";
import { formatNaira } from "@/lib/types";

interface Category {
  id: string;
  name: string;
}

interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  available_count: number;
  category_id: string | null;
  categoryName: string | null;
  bulk_format_fields: string[] | null;
  field_1_label: string | null;
  field_2_label: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  username: "Username",
  password: "Password",
  email: "Mail",
  email_password: "Mail password",
  recovery_email: "Recovery mail",
  two_fa: "2FA key",
  field_1: "Field 1",
  field_2: "Field 2",
};

const ALL_FIELDS = Object.keys(FIELD_LABELS);
const DEFAULT_ORDER = ["username", "password", "two_fa", "email", "email_password", "recovery_email", "field_1", "field_2"];

interface Preset {
  name: string;
  fields: string[];
  field1Label?: string;
  field2Label?: string;
}

// Matches the exact formats given for the site's own log products.
const PRESETS: Preset[] = [
  {
    name: "Facebook",
    fields: ["username", "password", "email", "email_password", "recovery_email", "two_fa", "field_1", "field_2"],
    field1Label: "Year",
    field2Label: "No of friends",
  },
  {
    name: "Facebook 2",
    fields: ["username", "password", "email", "email_password", "field_1", "field_2"],
    field1Label: "Year",
    field2Label: "No of friends",
  },
  {
    name: "Instagram / TikTok",
    fields: ["username", "password", "email", "email_password"],
  },
  {
    name: "Twitter",
    fields: ["username", "password", "email", "email_password", "two_fa"],
  },
];

/** Ordered field-picker used both when creating a template and when editing
 * an existing one's bulk-upload format. */
function FormatEditor({
  fields,
  setFields,
  field1Label,
  setField1Label,
  field2Label,
  setField2Label,
}: {
  fields: string[];
  setFields: (f: string[]) => void;
  field1Label: string;
  setField1Label: (v: string) => void;
  field2Label: string;
  setField2Label: (v: string) => void;
}) {
  const available = ALL_FIELDS.filter((f) => !fields.includes(f));

  return (
    <div className="space-y-3">
      <div>
        <div className="label mb-1">Bulk upload format (TXT field order)</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="btn-ghost h-7 px-2.5 py-0 text-xs"
              onClick={() => {
                setFields(p.fields);
                setField1Label(p.field1Label ?? "");
                setField2Label(p.field2Label ?? "");
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {fields.length === 0 && (
          <span className="text-xs text-[var(--text-muted)]">No fields selected — pick a preset or add below.</span>
        )}
        {fields.map((f, i) => (
          <span
            key={f}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-black/5 px-2.5 py-1 text-xs dark:bg-white/5"
          >
            <span className="font-mono text-[var(--text-muted)]">{i + 1}.</span>
            {f === "field_1" && field1Label ? field1Label : f === "field_2" && field2Label ? field2Label : FIELD_LABELS[f]}
            <button
              type="button"
              aria-label={`Remove ${FIELD_LABELS[f]}`}
              className="text-[var(--text-muted)] hover:text-red-400"
              onClick={() => setFields(fields.filter((x) => x !== f))}
            >
              &times;
            </button>
          </span>
        ))}
      </div>

      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.map((f) => (
            <button
              key={f}
              type="button"
              className="btn-ghost h-7 px-2.5 py-0 text-xs"
              onClick={() => setFields([...fields, f])}
            >
              + {FIELD_LABELS[f]}
            </button>
          ))}
        </div>
      )}

      {(fields.includes("field_1") || fields.includes("field_2")) && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {fields.includes("field_1") && (
            <div>
              <label className="label" htmlFor="field1label">
                Field 1 label
              </label>
              <input
                className="input h-9"
                id="field1label"
                value={field1Label}
                onChange={(e) => setField1Label(e.target.value)}
                placeholder="e.g. Year"
              />
            </div>
          )}
          {fields.includes("field_2") && (
            <div>
              <label className="label" htmlFor="field2label">
                Field 2 label
              </label>
              <input
                className="input h-9"
                id="field2label"
                value={field2Label}
                onChange={(e) => setField2Label(e.target.value)}
                placeholder="e.g. No of friends"
              />
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)]">
        Delimiter (<code>:</code> or <code>|</code>) is auto-detected. Each uploaded TXT line is read
        positionally in the order above, e.g.{" "}
        <code className="text-[var(--text)]">{fields.map((f) => (f === "field_1" ? "year" : f === "field_2" ? "friends" : f)).join(":") || "username:password"}</code>
        .
      </p>
    </div>
  );
}

export default function ProductTemplateManager({
  categories,
  initial,
}: {
  categories: Category[];
  initial: TemplateItem[];
}) {
  const [list, setList] = useState(initial);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<string[]>(DEFAULT_ORDER);
  const [field1Label, setField1Label] = useState("");
  const [field2Label, setField2Label] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<string[]>([]);
  const [editField1Label, setEditField1Label] = useState("");
  const [editField2Label, setEditField2Label] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/admin/product-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        categoryId: categoryId || null,
        price,
        description,
        bulkFormatFields: fields,
        field1Label,
        field2Label,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to create template");
      return;
    }

    const category = categories.find((c) => c.id === json.template.category_id);
    setList((prev) => [{ ...json.template, categoryName: category?.name ?? null }, ...prev]);
    setName("");
    setCategoryId("");
    setPrice("");
    setDescription("");
    setFields(DEFAULT_ORDER);
    setField1Label("");
    setField2Label("");
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/product-templates?id=${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Failed to delete template");
      return;
    }
    setList((prev) => prev.filter((t) => t.id !== id));
  }

  function startEdit(t: TemplateItem) {
    setEditingId(t.id);
    setEditFields(t.bulk_format_fields && t.bulk_format_fields.length > 0 ? t.bulk_format_fields : DEFAULT_ORDER);
    setEditField1Label(t.field_1_label ?? "");
    setEditField2Label(t.field_2_label ?? "");
  }

  async function saveEdit(id: string) {
    setEditBusy(true);
    setError(null);
    const res = await fetch("/api/admin/product-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        bulkFormatFields: editFields,
        field1Label: editField1Label,
        field2Label: editField2Label,
      }),
    });
    const json = await res.json();
    setEditBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to save format");
      return;
    }
    setList((prev) => prev.map((t) => (t.id === id ? { ...t, ...json.template } : t)));
    setEditingId(null);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={create} className="card space-y-4 p-6">
        <h3 className="font-bold">Create New Product Template</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="product_name">
              Product Name
            </label>
            <input
              className="input"
              id="product_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Instagram Premium Accounts"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <select
              className="input"
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="price">
              Price (₦)
            </label>
            <input
              className="input"
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="2500"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="description">
              Description
            </label>
            <textarea
              className="input"
              id="description"
              rows={1}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this product template..."
            />
          </div>
        </div>

        <FormatEditor
          fields={fields}
          setFields={setFields}
          field1Label={field1Label}
          setField1Label={setField1Label}
          field2Label={field2Label}
          setField2Label={setField2Label}
        />

        <button className="btn-primary" type="submit" disabled={busy}>
          + {busy ? "Creating..." : "Create Template"}
        </button>
      </form>

      <div className="card divide-y divide-[var(--border)]">
        {list.length === 0 && (
          <p className="p-6 text-sm text-[var(--text-muted)]">No product templates yet.</p>
        )}
        {list.map((t) => (
          <div key={t.id} className="px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 break-words">
                <div className="font-bold">{t.name}</div>
                <div className="text-sm text-[var(--text-muted)]">
                  {t.categoryName ?? "Uncategorized"} &middot; {formatNaira(t.price_cents)} &middot;{" "}
                  {t.available_count} in stock
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  className="btn-ghost"
                  onClick={() => (editingId === t.id ? setEditingId(null) : startEdit(t))}
                >
                  {editingId === t.id ? "Close" : "Edit format"}
                </button>
                <button
                  className="btn-ghost border-red-500/30 text-red-300 hover:border-red-500/60"
                  onClick={() => remove(t.id)}
                >
                  Delete
                </button>
              </div>
            </div>

            {editingId === t.id && (
              <div className="mt-4 space-y-3 rounded-xl border border-[var(--border)] p-4">
                <FormatEditor
                  fields={editFields}
                  setFields={setEditFields}
                  field1Label={editField1Label}
                  setField1Label={setEditField1Label}
                  field2Label={editField2Label}
                  setField2Label={setEditField2Label}
                />
                <button className="btn-primary" onClick={() => saveEdit(t.id)} disabled={editBusy}>
                  {editBusy ? "Saving..." : "Save format"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
