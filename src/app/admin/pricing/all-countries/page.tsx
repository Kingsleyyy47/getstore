import PageHeader from "@/components/PageHeader";
import { IconGlobe } from "@/components/icons";
import * as daisysim from "@/lib/daisysim";
import AllCountriesPricingClient from "./AllCountriesPricingClient";

export default async function AllCountriesPricingPage() {
  let countries: { id: string; name: string }[] = [];
  let loadError: string | null = null;
  try {
    const raw = await daisysim.getCountries();
    countries = raw.map((c) => ({ id: String(c.id), name: c.name }));
  } catch (e) {
    loadError = e instanceof daisysim.DaisySimError ? e.message : "Failed to load countries";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconGlobe />}
        title="All Countries pricing"
        subtitle="Set the ₦ price customers pay per DaisySim service, per country. Favorites pin to the top here and on the customer-facing page."
      />
      {loadError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      ) : (
        <AllCountriesPricingClient countries={countries} />
      )}
    </div>
  );
}
