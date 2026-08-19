import { requireUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();

  return (
    <div className="mx-auto flex max-w-6xl flex-col sm:flex-row">
      <Sidebar variant="customer" isAdmin={profile.role === "admin"} />
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</div>
    </div>
  );
}
