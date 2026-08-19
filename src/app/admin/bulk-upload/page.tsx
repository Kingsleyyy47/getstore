import { createClient } from "@/lib/supabase/server";
import BulkUploadForm from "@/components/BulkUploadForm";

export default async function BulkUploadPage() {
  const supabase = createClient();
  const { data: templates } = await supabase
    .from("product_templates")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 16V4M6 10l6-6 6 6" />
            <path d="M4 20h16" />
          </svg>
          Bulk Account Upload
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Upload CSV files with account credentials to an existing product template.
        </p>
      </div>
      <BulkUploadForm templates={templates ?? []} />
    </div>
  );
}
