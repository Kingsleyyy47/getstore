"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

/** "Edit" on a template's 3-dot menu -- name + description only, per the
 * Admin -> Categories flow. (Price/category/format changes still live on
 * the older Product Templates page if ever needed.) */
export default function EditTemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: { id: string; name: string; description: string | null };
  onClose: () => void;
  onSaved: (updated: { id: string; name: string; description: string | null }) => void;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/product-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: template.id, name, description }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to save changes");
      return;
    }
    onSaved({
      id: template.id,
      name: json.template.name,
      description: json.template.description ?? null,
    });
  }

  return (
    <Modal title="Edit template" onClose={onClose}>
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <div>
          <label className="label" htmlFor="edit_tmpl_name">
            Name
          </label>
          <input
            className="input"
            id="edit_tmpl_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="edit_tmpl_desc">
            Description
          </label>
          <textarea
            className="input"
            id="edit_tmpl_desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button className="btn-primary w-full" type="button" onClick={save} disabled={busy}>
          {busy ? "Saving..." : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}
