import PageHeader from "@/components/PageHeader";
import ServicePricingManager from "@/components/admin/ServicePricingManager";
import { IconPhone } from "@/components/icons";

export default function UsaCanadaPricingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconPhone />}
        title="USA & Canada pricing"
        subtitle="Set the ₦ price customers pay per DaisySMS service. Favorites pin to the top here and on the customer-facing page."
      />
      <ServicePricingManager provider="daisysms" providerLabel="DaisySMS" />
    </div>
  );
}
