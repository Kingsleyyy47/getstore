import { createClient } from "@/lib/supabase/server";
import RoleManager from "@/components/RoleManager";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { IconShield } from "@/components/icons";

export default async function AdminRolesPage() {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconShield />}
        title="Roles"
        subtitle="Promote a customer to admin for full access. You can't change your own role from here."
      />
      <RoleManager items={profiles ?? []} currentUserId={profile!.id} />
    </div>
  );
}
