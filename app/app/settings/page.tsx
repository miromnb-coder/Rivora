import Image from "next/image";
import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { removeWorkspaceLogo, updateWorkspaceSettings } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const { supabase, workspace } = await requireWorkspace();
  const { data: organization } = await supabase
    .from("organizations")
    .select("name,business_id,address_line1,address_line2,postal_code,city,country,email,phone,logo_path,default_tax_rate,default_quote_validity_days,onboarding_completed_at")
    .eq("id", workspace.id)
    .maybeSingle();

  let logoDataUrl: string | null = null;
  if (organization?.logo_path) {
    const { data: logo } = await supabase.storage
      .from("workspace-assets")
      .download(organization.logo_path);

    if (logo) {
      const bytes = Buffer.from(await logo.arrayBuffer());
      const mime =
        logo.type ||
        (organization.logo_path.endsWith(".png") ? "image/png" : "image/jpeg");
      logoDataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
    }
  }

  const canManage = ["owner", "admin"].includes(workspace.role);

  return (
    <div className="app-page-v2">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <div className="app-kicker-v2">Workspace settings</div>
          <h1 className="mt-2 text-4xl font-extrabold tracking-[-.04em]">
            Company details used on every quote.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            These values become the default commercial settings and seller identity in
            customer-facing PDFs.
          </p>
        </div>
        <Link href="/app/setup" className="btn-secondary">
          Pilot setup →
        </Link>
      </header>

      {params.saved ? (
        <div className="mb-6 rounded-xl bg-[var(--green-soft)] p-4 text-sm text-[var(--green)]">
          Company settings saved.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="surface p-6 sm:p-8">
          <form action={updateWorkspaceSettings} className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Company name
                </span>
                <input
                  name="name"
                  required
                  maxLength={200}
                  defaultValue={organization?.name || workspace.name}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3"
                />
              </label>

              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Y-tunnus / Business ID{" "}
                  <em className="font-normal normal-case">optional</em>
                </span>
                <input
                  name="businessId"
                  maxLength={64}
                  defaultValue={organization?.business_id || ""}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3"
                />
              </label>

              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Company email
                </span>
                <input
                  name="email"
                  type="email"
                  maxLength={320}
                  defaultValue={organization?.email || ""}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3"
                />
              </label>

              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Phone
                </span>
                <input
                  name="phone"
                  maxLength={80}
                  defaultValue={organization?.phone || ""}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Address
                </span>
                <input
                  name="addressLine1"
                  maxLength={200}
                  defaultValue={organization?.address_line1 || ""}
                  placeholder="Street address"
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3"
                />
                <input
                  name="addressLine2"
                  maxLength={200}
                  defaultValue={organization?.address_line2 || ""}
                  placeholder="Address line 2 (optional)"
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3"
                />
              </label>

              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Postal code
                </span>
                <input
                  name="postalCode"
                  maxLength={32}
                  defaultValue={organization?.postal_code || ""}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3"
                />
              </label>

              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  City
                </span>
                <input
                  name="city"
                  maxLength={120}
                  defaultValue={organization?.city || ""}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3"
                />
              </label>

              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Country
                </span>
                <input
                  name="country"
                  maxLength={120}
                  defaultValue={organization?.country || "Finland"}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3"
                />
              </label>

              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Default VAT %
                </span>
                <input
                  name="defaultTaxRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  defaultValue={Number(organization?.default_tax_rate ?? 25.5)}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3"
                />
              </label>

              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Quote validity (days)
                </span>
                <input
                  name="defaultQuoteValidityDays"
                  type="number"
                  min="1"
                  max="365"
                  step="1"
                  required
                  defaultValue={Number(organization?.default_quote_validity_days ?? 14)}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Logo · PNG/JPEG, max 2 MB
                </span>
                <input
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="mt-2 block w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm"
                />
              </label>
            </div>

            {canManage ? (
              <button className="btn-primary w-fit">Save company settings</button>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Owner or admin access is required to edit workspace settings.
              </p>
            )}
          </form>
        </section>

        <aside className="surface p-6">
          <div className="upload-v2-section-label">PDF identity</div>
          <div className="mt-4 flex min-h-24 items-center justify-center rounded-2xl border border-[var(--line)] bg-white p-4">
            {logoDataUrl ? (
              <Image
                src={logoDataUrl}
                alt={`${organization?.name || workspace.name} logo`}
                width={220}
                height={80}
                unoptimized
                className="max-h-20 w-auto object-contain"
              />
            ) : (
              <span className="text-sm text-[var(--muted)]">No logo uploaded</span>
            )}
          </div>

          <h2 className="mt-5 text-xl font-bold">
            {organization?.name || workspace.name}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {[
              organization?.address_line1,
              [organization?.postal_code, organization?.city].filter(Boolean).join(" "),
              organization?.country,
            ]
              .filter(Boolean)
              .join(", ") || "Address not set"}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {organization?.email || "Email not set"}
            {organization?.phone ? ` · ${organization.phone}` : ""}
          </p>

          {organization?.logo_path && canManage ? (
            <form action={removeWorkspaceLogo} className="mt-5">
              <button className="btn-secondary">Remove logo</button>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
