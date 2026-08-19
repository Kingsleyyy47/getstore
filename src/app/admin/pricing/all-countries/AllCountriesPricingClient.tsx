"use client";

import { useState } from "react";
import ServicePricingManager from "@/components/admin/ServicePricingManager";

export default function AllCountriesPricingClient({
  countries,
}: {
  countries: { id: string; name: string }[];
}) {
  const [country, setCountry] = useState(countries[0]?.id ?? "");

  return (
    <ServicePricingManager
      provider="daisysim"
      providerLabel="DaisySim"
      country={country}
      countries={countries}
      onCountryChange={setCountry}
    />
  );
}
