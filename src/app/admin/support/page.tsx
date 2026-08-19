import { getSupportLinks } from "@/lib/settings";
import SupportLinksForm from "@/components/SupportLinksForm";
import SocialLinks, { hasAnySocialLink } from "@/components/SocialLinks";
import PageHeader from "@/components/PageHeader";
import { IconMessage } from "@/components/icons";

export default async function AdminSupportPage() {
  const links = await getSupportLinks();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        icon={<IconMessage />}
        title="Support"
        subtitle="Set the support and social channel links shown site-wide. Any link left blank simply doesn't appear -- no dead icons shown to customers."
      />

      {hasAnySocialLink(links) && (
        <div className="card p-6">
          <div className="mb-3 text-sm font-semibold">Live preview</div>
          <SocialLinks links={links} variant="light" />
        </div>
      )}

      <SupportLinksForm initial={links} />
    </div>
  );
}
