import PageHeader from "@/components/PageHeader";
import ServicePricingManager from "@/components/admin/ServicePricingManager";
import { IconFlag } from "@/components/icons";
import * as daisysim2 from "@/lib/daisysim2";

export default async function UsOnlyPricingPage() {
  let countryId = "USA";
  try {
    const countries = await daisysim2.getCountries();
    const found = countries.find((c) => /united states|usa|^us$/i.test(c.name.trim()));
    if (found) countryId = found.id;
  } catch {
    /* fall back to "USA" -- the pricing manager will surface any real error itself */
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconFlag />}
        title="US Only pricing"
        subtitle="Set the ₦ price customers pay per Getatext service. Favorites pin to the top here and on the customer-facing page."
      />
      <ServicePricingManager provider="daisysim2" providerLabel="Getatext (US Only)" country={countryId} />
    </div>
  );
}
