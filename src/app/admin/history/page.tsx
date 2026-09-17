import { requireRole } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import AdminHistoryManager from "@/components/AdminHistoryManager";
import { IconHistory } from "@/components/icons";

export default async function AdminHistoryPage() {
  await requireRole("admin");

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconHistory />}
        title="History"
        subtitle="Everything every customer has ever bought -- Marketplace orders, each numbers provider, and deposits -- kept in separate sections so one long merged feed doesn't bury what you're looking for. Open a section and search by the customer's email to find a specific one."
      />
      <AdminHistoryManager />
    </div>
  );
}
