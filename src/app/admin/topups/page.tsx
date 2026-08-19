import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TopupQueue from "@/components/TopupQueue";
import PageHeader from "@/components/PageHeader";
import { IconWallet } from "@/components/icons";

export default async function AdminTopupsPage() {
  await requireRole("admin");
  const supabase = createClient();

  const { data } = await supabase
    .from("topup_requests")
    .select("*, profiles(email)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const items = (data ?? []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    amount_cents: r.amount_cents,
    reference: r.reference,
    created_at: r.created_at,
    userEmail: r.profiles?.email ?? r.user_id,
  }));

  return (
    <div className="space-y-6">
      <PageHeader icon={<IconWallet />} title="Pending top-ups" />
      <TopupQueue items={items} />
    </div>
  );
}
