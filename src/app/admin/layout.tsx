import { requireRole } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Central gate: every /admin/* page requires the admin role. Individual
  // pages also call requireRole("admin") for defense in depth, but this is
  // the primary guard.
  await requireRole("admin");

  return (
    <div className="mx-auto flex max-w-6xl flex-col sm:flex-row">
      <Sidebar variant="admin" isAdmin />
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</div>
    </div>
  );
}
