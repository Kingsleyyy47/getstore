"use client";

import { useEffect, useRef, useState } from "react";
import { formatNaira } from "@/lib/types";
import {
  IconArrowUp,
  IconArrowDown,
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconPlus,
} from "@/components/icons";
import AddCategoryModal, { type CategoryFormResult } from "@/components/AddCategoryModal";
import AddTemplateModal, { type CreatedTemplate, type LogoOption } from "@/components/AddTemplateModal";
import EditTemplateModal from "@/components/EditTemplateModal";
import ScopedBulkUploadModal from "@/components/ScopedBulkUploadModal";

export interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  availableCount: number;
  categoryId: string;
  archived: boolean;
  imageUrl: string | null;
  logoUrl: string | null;
  bulkFormatFields: string[] | null;
  field1Label: string | null;
  field2Label: string | null;
}

export interface CategoryItem {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  sortOrder: number;
  templates: TemplateItem[];
}

/** Small self-closing "..." menu -- closes on an outside click. */
function DotMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn-ghost h-8 w-8 shrink-0 p-0"
        aria-label="More options"
        onClick={() => setOpen((v) => !v)}
      >
        <IconDotsVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] py-1 shadow-xl">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
                item.danger ? "text-red-400" : ""
              }`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-black/5 dark:bg-white/5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[9px] text-[var(--text-muted)]">{alt}</span>
      )}
    </div>
  );
}

/**
 * The one consolidated "Categories" admin screen -- categories in their
 * display order, each collapsible to the product templates inside it, with
 * an "Add Template" button and, per template, a 3-dot menu for Add Logs
 * (scoped bulk upload) / Edit (name + description) / Archive. Category
 * reordering (used to be the separate Category Shuffle page) and
 * create/edit/delete for categories themselves live here too, so this is
 * now the only place category-related admin work happens.
 */
export default function CategoryTemplateManager({
  initial,
  logoOptions,
}: {
  initial: CategoryItem[];
  logoOptions: LogoOption[];
}) {
  const [categories, setCategories] = useState(initial);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<CategoryItem | null>(null);
  const [addTemplateFor, setAddTemplateFor] = useState<CategoryItem | null>(null);
  const [editTemplate, setEditTemplate] = useState<TemplateItem | null>(null);
  const [bulkUploadFor, setBulkUploadFor] = useState<TemplateItem | null>(null);

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    setCategories(next);
    setReordering(true);
    setError(null);
    const res = await fetch("/api/admin/categories/order", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: next.map((c) => c.id) }),
    });
    setReordering(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Failed to save the new order");
    }
  }

  async function deleteCategory(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Failed to delete category");
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  function onCategorySaved(result: CategoryFormResult) {
    setCategories((prev) => {
      const exists = prev.some((c) => c.id === result.id);
      if (exists) {
        return prev.map((c) =>
          c.id === result.id
            ? { ...c, name: result.name, description: result.description, logoUrl: result.logoUrl }
            : c
        );
      }
      return [...prev, { ...result, sortOrder: prev.length, templates: [] }];
    });
    setAddCategoryOpen(false);
    setEditCategory(null);
  }

  function onTemplateCreated(categoryId: string, template: CreatedTemplate) {
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, templates: [...c.templates, template] } : c))
    );
    setOpenIds((prev) => new Set(prev).add(categoryId));
    setAddTemplateFor(null);
  }

  function onTemplateSaved(updated: { id: string; name: string; description: string | null }) {
    setCategories((prev) =>
      prev.map((c) => ({
        ...c,
        templates: c.templates.map((t) =>
          t.id === updated.id ? { ...t, name: updated.name, description: updated.description } : t
        ),
      }))
    );
    setEditTemplate(null);
  }

  async function toggleArchived(template: TemplateItem) {
    setError(null);
    const nextArchived = !template.archived;
    const res = await fetch("/api/admin/product-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: template.id, archived: nextArchived }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to update template");
      return;
    }
    setCategories((prev) =>
      prev.map((c) => ({
        ...c,
        templates: c.templates.map((t) => (t.id === template.id ? { ...t, archived: nextArchived } : t)),
      }))
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          Top of this list shows first on the Marketplace page and the dashboard&apos;s Marketplace
          preview.
        </p>
        {reordering && <span className="text-xs text-[var(--text-muted)]">Saving order...</span>}
      </div>

      <div className="space-y-3">
        {categories.length === 0 && (
          <div className="card p-6 text-sm text-[var(--text-muted)]">No categories yet.</div>
        )}
        {categories.map((category, index) => {
          const isOpen = openIds.has(category.id);
          const stockTotal = category.templates.reduce((sum, t) => sum + t.availableCount, 0);
          return (
            <div key={category.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => toggleOpen(category.id)}
                >
                  <span className="shrink-0 text-[var(--text-muted)]">
                    {isOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                  </span>
                  <Thumb url={category.logoUrl} alt="None" />
                  <div className="min-w-0">
                    <div className="truncate font-bold">{category.name}</div>
                    <div className="truncate text-xs text-[var(--text-muted)]">
                      {category.templates.length} product{category.templates.length === 1 ? "" : "s"} &middot;{" "}
                      {stockTotal} in stock
                    </div>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="btn-ghost h-8 w-8 p-0"
                    aria-label={`Move ${category.name} up`}
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || reordering}
                  >
                    <IconArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost h-8 w-8 p-0"
                    aria-label={`Move ${category.name} down`}
                    onClick={() => move(index, 1)}
                    disabled={index === categories.length - 1 || reordering}
                  >
                    <IconArrowDown size={16} />
                  </button>
                  <DotMenu
                    items={[
                      { label: "Edit category", onClick: () => setEditCategory(category) },
                      { label: "Delete category", danger: true, onClick: () => deleteCategory(category.id) },
                    ]}
                  />
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-[var(--border)]">
                  {category.templates.length === 0 && (
                    <p className="px-4 py-4 text-sm text-[var(--text-muted)]">
                      No products in this category yet.
                    </p>
                  )}
                  <div className="divide-y divide-[var(--border)]">
                    {category.templates.map((t) => (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                        <Thumb url={t.logoUrl} alt="None" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold">{t.name}</span>
                            {t.archived && (
                              <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] dark:bg-white/10">
                                Archived
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {formatNaira(t.priceCents)} &middot; {t.availableCount} in stock
                          </div>
                        </div>
                        <DotMenu
                          items={[
                            { label: "Add logs", onClick: () => setBulkUploadFor(t) },
                            { label: "Edit", onClick: () => setEditTemplate(t) },
                            {
                              label: t.archived ? "Unarchive" : "Archive",
                              onClick: () => toggleArchived(t),
                            },
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="p-4">
                    <button
                      type="button"
                      className="btn-ghost flex w-full items-center justify-center gap-2"
                      onClick={() => setAddTemplateFor(category)}
                    >
                      <IconPlus size={16} /> Add template
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="btn-primary flex w-full items-center justify-center gap-2"
        onClick={() => setAddCategoryOpen(true)}
      >
        <IconPlus size={16} /> Add category
      </button>

      {addCategoryOpen && (
        <AddCategoryModal onClose={() => setAddCategoryOpen(false)} onSaved={onCategorySaved} />
      )}
      {editCategory && (
        <AddCategoryModal
          initial={editCategory}
          onClose={() => setEditCategory(null)}
          onSaved={onCategorySaved}
        />
      )}
      {addTemplateFor && (
        <AddTemplateModal
          categoryId={addTemplateFor.id}
          categoryName={addTemplateFor.name}
          logoOptions={logoOptions}
          onClose={() => setAddTemplateFor(null)}
          onCreated={(t) => onTemplateCreated(addTemplateFor.id, t)}
        />
      )}
      {editTemplate && (
        <EditTemplateModal
          template={editTemplate}
          onClose={() => setEditTemplate(null)}
          onSaved={onTemplateSaved}
        />
      )}
      {bulkUploadFor && (
        <ScopedBulkUploadModal
          template={{
            id: bulkUploadFor.id,
            name: bulkUploadFor.name,
            bulkFormatFields: bulkUploadFor.bulkFormatFields,
            field1Label: bulkUploadFor.field1Label,
            field2Label: bulkUploadFor.field2Label,
          }}
          onClose={() => setBulkUploadFor(null)}
          onDone={(result) => {
            setCategories((prev) =>
              prev.map((c) => ({
                ...c,
                templates: c.templates.map((t) =>
                  t.id === bulkUploadFor.id
                    ? { ...t, availableCount: t.availableCount + result.inserted }
                    : t
                ),
              }))
            );
          }}
        />
      )}
    </div>
  );
}
