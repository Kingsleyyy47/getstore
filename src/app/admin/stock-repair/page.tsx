import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { IconShieldAlert } from "@/components/icons";
import StockRepairClient from "./StockRepairClient";

export default async function StockRepairPage() {
  await requireRole("admin");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        icon={<IconShieldAlert />}
        title="Fix corrupted bulk-upload stock"
        subtitle="One-off cleanup for accounts uploaded before the combo-list parser fix -- finds rows still carrying the old bug's signature (a whole raw line jammed into one field) and rebuilds username / password / 2FA / email correctly, moving the leftover cookie/session data into its own field. Covers every product, including stock already sold to customers. Always preview before applying."
      />
      <StockRepairClient />
    </div>
  );
}
