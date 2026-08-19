import { requireRole } from "@/lib/auth";
import CustomerDetail from "@/components/CustomerDetail";

export default async function AdminCustomerPage({ params }: { params: { id: string } }) {
  const profile = await requireRole("admin");
  return <CustomerDetail customerId={params.id} canAdjustBalance={profile.role === "admin"} />;
}
