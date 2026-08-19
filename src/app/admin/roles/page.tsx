import { createClient } from "@/lib/supabase/server";
import RoleManager from "@/components/RoleManager";
import { getCurrentProfile } from "@/lib/auth";

export default async function AdminRolesPage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Roles</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Promote a customer to admin for full access. You can't change your own role from here.
        </p>
      </div>
      <RoleManager items={profiles ?? []} currentUserId={profile!.id} />
    </div>
  );
}
