import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AnnouncementManager from "@/components/AnnouncementManager";

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
      <div>
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Publishing a new announcement shows it as a pop-up to every signed-in user next time they
          load a page (until they dismiss it).
        </p>
      </div>
      <AnnouncementManager initial={data ?? []} />
    </div>
  );
}
