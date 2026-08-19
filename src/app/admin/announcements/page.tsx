import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AnnouncementManager from "@/components/AnnouncementManager";
import PageHeader from "@/components/PageHeader";
import { IconBell } from "@/components/icons";

export default async function AnnouncementsPage() {
  await requireRole("admin");
  const supabase = createClient();

  const { data } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconBell />}
        title="Announcements"
        subtitle="Publishing a new announcement shows it as a pop-up to every signed-in user next time they load a page (until they dismiss it)."
      />
      <AnnouncementManager initial={data ?? []} />
    </div>
  );
}
