import { createClient } from "@/lib/supabase/server";
import AdminNotificationsManager from "@/components/AdminNotificationsManager";
import PageHeader from "@/components/PageHeader";
import { IconBell } from "@/components/icons";

export default async function AdminNotificationsPage() {
  const supabase = createClient();

  const { data } = await supabase
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false });

  const items = (data ?? []).map((row: any) => ({
    id: row.id as string,
    type: row.type as string,
    title: row.title as string,
    message: row.message as string,
    meta: (row.meta as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at as string,
    readAt: (row.read_at as string | null) ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconBell />}
        title="Notifications"
        subtitle="Technical or provider errors that were hidden from customers land here instead, so nothing gets lost."
      />
      <AdminNotificationsManager initial={items} />
    </div>
  );
}
