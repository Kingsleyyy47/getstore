import { createClient } from "@/lib/supabase/server";
import BulkUploadForm from "@/components/BulkUploadForm";
import PageHeader from "@/components/PageHeader";
import { IconUpload } from "@/components/icons";

export default async function BulkUploadPage() {
  const supabase = createClient();
  const { data: templates } = await supabase
    .from("product_templates")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        icon={<IconUpload />}
        title="Bulk Account Upload"
        subtitle="Upload CSV files with account credentials to an existing product template."
      />
      <BulkUploadForm templates={templates ?? []} />
    </div>
  );
}
