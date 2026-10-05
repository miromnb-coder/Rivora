import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { getLocale } from "@/lib/locale";
import { getBusinessCentralConfigurationStatus } from "@/lib/rivora/erp/business-central";
import { removeBusinessCentralMapping, saveBusinessCentralMapping } from "./actions";

export default async function BusinessCentralSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; verified?: string; removed?: string }>;
}) {
  const [query, locale, { supabase, workspace }] = await Promise.all([
    searchParams,
    getLocale(),
    requireWorkspace(),
  ]);
  const fi = locale === "fi";
  const canManage = ["owner", "admin"].includes(workspace.role);
  if (workspace.erpProvider !== "business_central") {
    redirect("/app/settings#erp");
  }
  const config = getBusinessCentralConfigurationStatus(workspace.id);

  const [{ data: customers }, { data: products }, { data: mappings }] = await Promise.all([
    supabase
      .from("customers")
      .select("id,name,external_id")
      .eq("organization_id", workspace.id)
      .order("name")
      .limit(500),
    supabase
      .from("products")
      .select("id,sku,name,manufacturer,manufacturer_part_number,active")
      .eq("organization_id", workspace.id)
      .eq("active", true)
      .order("sku")
      .limit(500),
    supabase
      .from("erp_entity_mappings")
      .select("entity_type,local_entity_id,external_number,external_id,metadata,updated_at")
      .eq("organization_id", workspace.id)
      .eq("provider", "business_central"),
  ]);

  const mappingByEntity = new Map(
    (mappings ?? []).map((mapping: any) => [
      `${mapping.entity_type}:${mapping.local_entity_id}`,
      mapping,
    ]),
  );

  const mappingVerified = (mapping: any) =>
    Boolean(
      mapping?.external_id &&
        mapping?.external_number &&
        (mapping?.metadata?.autoMatched === true || mapping?.metadata?.bcValidated === true),
    );

  const mappedCustomers = (customers ?? []).filter((customer: any) =>
    mappingVerified(mappingByEntity.get(`customer:${customer.id}`)),
  ).length;
  const mappedProducts = (products ?? []).filter((product: any) =>
    mappingVerified(mappingByEntity.get(`product:${product.id}`)),
  ).length;

  return (
    <div className="app-page-v2 bc-mappings-page">
      <div className="mb-5">
        <Link
          href="/app/settings#erp"
          className="text-[13px] font-semibold text-[#5f645f] hover:text-[var(--app-ink)]"
        >
          ← {fi ? "Asetukset" : "Settings"}
        </Link>
      </div>

      <header className="mb-7 max-w-[760px]">
        <div className="app-kicker-v2">Business Central</div>
        <h1 className="mt-2 break-words !text-[30px] !font-semibold !leading-9 tracking-[-.035em] lg:!text-[34px] lg:!leading-10">
          {fi ? "Business Central -vastineet" : "Business Central mappings"}
        </h1>
        <p className="mt-2 max-w-[680px] text-[13px] leading-5 text-[var(--muted)]">
          {fi
            ? "Tarkista ja korjaa asiakas- ja tuotevastineet. Averomira käyttää näitä automaattisesti tulevissa tilauksissa."
            : "Review and correct customer and product mappings. Averomira reuses them automatically for future orders."}
        </p>
      </header>

      {query.error ? (
        <div className="mb-5 rounded-xl border border-[#f0d2d2] bg-[#fff6f6] p-4 text-sm text-[#8a2f2f]">
          {query.error}
        </div>
      ) : null}

      {query.removed ? (
        <div className="mb-5 rounded-xl border border-[#dfe7df] bg-[#f7faf7] p-4 text-sm text-[#426048]">
          {fi
            ? "Business Central -vastine poistettiin. Sitä käyttävät luonnokset vaativat uuden tarkistuksen ennen vientiä."
            : "Business Central mapping removed. Drafts that used it require re-verification before export."}
        </div>
      ) : null}

      {query.saved ? (
        <div className="mb-5 rounded-xl border border-[#dfe7df] bg-[#f7faf7] p-4 text-sm text-[#426048]">
          {fi
            ? `Business Central -vastine tarkistettiin ja tallennettiin${query.verified ? `: ${query.verified}` : "."}`
            : `Business Central mapping verified and saved${query.verified ? `: ${query.verified}` : "."}`}
        </div>
      ) : null}

      <section className="border-y border-[var(--app-line)] py-5 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-[680px]">
            <div className="upload-v2-section-label">{fi ? "Yhteys" : "Connection"}</div>
            <h2 className="mt-1 text-[19px] font-semibold leading-[26px] tracking-[-.02em] text-[var(--app-ink)]">
              {config.configured
                ? (fi ? "Yhteys valmis" : "Connection ready")
                : (fi ? "Yhteys vaatii huomiota" : "Connection needs attention")}
            </h2>
            <p className="mt-1.5 text-[13px] leading-5 text-[var(--muted)]">
              {fi
                ? "Salaisia tunnuksia ei näytetä tässä näkymässä."
                : "Secret credentials are never shown in this view."}
            </p>
          </div>

          <span className={config.configured ? "settings-status is-ready" : "settings-status is-warning"}>
            {config.configured
              ? (fi ? "Yhdistetty" : "Connected")
              : (fi ? "Vaatii huomiota" : "Needs attention")}
          </span>
        </div>

        <div className="mt-5 grid border-y border-[#e5e6e2] sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 py-3.5 sm:pr-4">
            <span className="block text-[10px] font-semibold uppercase leading-[14px] tracking-[.05em] text-[#858a86]">
              {fi ? "Ympäristö" : "Environment"}
            </span>
            <strong className="mt-1 block break-words text-[13px] font-semibold leading-[18px] text-[#3b403c]">
              {config.environment || "—"}
            </strong>
          </div>

          <div className="min-w-0 border-t border-[#e5e6e2] py-3.5 sm:border-l sm:border-t-0 sm:pl-4 xl:pr-4">
            <span className="block text-[10px] font-semibold uppercase leading-[14px] tracking-[.05em] text-[#858a86]">
              Company ID
            </span>
            <strong className="mt-1 block break-words text-[12px] font-semibold leading-[18px] tracking-[-.01em] text-[#3b403c]">
              {config.companyId || "—"}
            </strong>
          </div>

          <div className="min-w-0 border-t border-[#e5e6e2] py-3.5 sm:pr-4 xl:border-l xl:border-t-0 xl:pl-4">
            <span className="block text-[10px] font-semibold uppercase leading-[14px] tracking-[.05em] text-[#858a86]">
              {fi ? "Asiakkaat" : "Customers"}
            </span>
            <strong className="mt-1 block text-[13px] font-semibold leading-[18px] text-[#3b403c]">
              {mappedCustomers}/{customers?.length ?? 0}
            </strong>
          </div>

          <div className="min-w-0 border-t border-[#e5e6e2] py-3.5 sm:border-l sm:pl-4 xl:border-t-0">
            <span className="block text-[10px] font-semibold uppercase leading-[14px] tracking-[.05em] text-[#858a86]">
              {fi ? "Tuotteet" : "Products"}
            </span>
            <strong className="mt-1 block text-[13px] font-semibold leading-[18px] text-[#3b403c]">
              {mappedProducts}/{products?.length ?? 0}
            </strong>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="border-b border-[var(--app-line)] pb-3">
          <div className="upload-v2-section-label">{fi ? "Asiakkaat" : "Customers"}</div>
          <h2 className="mt-1 text-lg font-semibold leading-6 tracking-[-.018em] text-[var(--app-ink)]">
            {fi ? "Business Central -asiakasnumerot" : "Business Central customer numbers"}
          </h2>
        </div>

        <div>
          {(customers ?? []).map((customer: any) => {
            const mapping = mappingByEntity.get(`customer:${customer.id}`) as any;
            return (
              <div
                key={customer.id}
                className="grid min-w-0 gap-3 border-b border-[#ecede9] py-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.82fr)] lg:items-center lg:gap-6"
              >
                <div className="min-w-0">
                  <strong className="block break-words text-sm font-semibold leading-5 text-[var(--app-ink)]">
                    {customer.name}
                  </strong>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-4 text-[var(--muted)]">
                    <span className="break-words">
                      {customer.external_id || (fi ? "Ei ERP-tunnusta" : "No ERP ID")}
                    </span>
                    <span>
                      {mappingVerified(mapping)
                        ? (fi ? "BC-vastine tarkistettu" : "BC mapping verified")
                        : mapping?.external_number
                          ? (fi ? "BC-tarkistus vaaditaan" : "BC verification required")
                          : (fi ? "Ei BC-vastinetta" : "No BC mapping")}
                    </span>
                  </div>
                </div>

                <form
                  action={saveBusinessCentralMapping}
                  className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <input type="hidden" name="entityType" value="customer" />
                  <input type="hidden" name="localEntityId" value={customer.id} />
                  <input
                    name="externalNumber"
                    required
                    defaultValue={mapping?.external_number || ""}
                    placeholder={fi ? "BC asiakasnumero" : "BC customer number"}
                    disabled={!canManage}
                    className="min-w-0"
                  />
                  {canManage ? (
                    <button className="btn-secondary w-full sm:w-auto">
                      {fi ? "Tarkista BC:stä ja tallenna" : "Verify in BC and save"}
                    </button>
                  ) : null}
                </form>
                {canManage && mapping?.external_number ? (
                  <form action={removeBusinessCentralMapping} className="lg:col-start-2">
                    <input type="hidden" name="entityType" value="customer" />
                    <input type="hidden" name="localEntityId" value={customer.id} />
                    <button className="text-xs font-semibold text-[#8a3b2f] underline underline-offset-4">
                      {fi ? "Poista vastine" : "Remove mapping"}
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <div className="border-b border-[var(--app-line)] pb-3">
          <div className="upload-v2-section-label">{fi ? "Tuotteet" : "Products"}</div>
          <h2 className="mt-1 text-lg font-semibold leading-6 tracking-[-.018em] text-[var(--app-ink)]">
            {fi ? "Business Central -item-numerot" : "Business Central item numbers"}
          </h2>
          <p className="mt-1.5 max-w-[680px] text-xs leading-[18px] text-[var(--muted)]">
            {fi
              ? "Täytä käsin vain puuttuvat tai väärät vastineet."
              : "Only fill mappings that are missing or incorrect."}
          </p>
        </div>

        <div>
          {(products ?? []).map((product: any) => {
            const mapping = mappingByEntity.get(`product:${product.id}`) as any;
            const productMeta = [
              product.sku ? `SKU ${product.sku}` : null,
              product.manufacturer,
              product.manufacturer_part_number ? `MPN ${product.manufacturer_part_number}` : null,
            ].filter(Boolean);

            return (
              <div
                key={product.id}
                className="grid min-w-0 gap-3 border-b border-[#ecede9] py-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.82fr)] lg:items-center lg:gap-6"
              >
                <div className="min-w-0">
                  <strong className="block break-words text-sm font-semibold leading-5 text-[var(--app-ink)]">
                    {product.name || product.sku}
                  </strong>
                  <p className="mt-1 break-words text-[11px] leading-4 text-[var(--muted)]">
                    {productMeta.join(" · ")}
                  </p>
                  {mapping?.external_number ? (
                    <p className="mt-0.5 break-words text-[11px] leading-4 text-[#686d69]">
                      {fi ? "Nykyinen BC item" : "Current BC item"}: {mapping.external_number}
                      {mapping?.metadata?.businessCentralDisplayName
                        ? ` · ${String(mapping.metadata.businessCentralDisplayName)}`
                        : ""}
                      {!mappingVerified(mapping)
                        ? (fi ? " · tarkistus vaaditaan" : " · verification required")
                        : ""}
                    </p>
                  ) : null}
                </div>

                <form
                  action={saveBusinessCentralMapping}
                  className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <input type="hidden" name="entityType" value="product" />
                  <input type="hidden" name="localEntityId" value={product.id} />
                  <input
                    name="externalNumber"
                    required
                    defaultValue={mapping?.external_number || ""}
                    placeholder="BC item no."
                    disabled={!canManage}
                    className="min-w-0"
                  />
                  {canManage ? (
                    <button className="btn-secondary w-full sm:w-auto">
                      {fi ? "Tarkista BC:stä ja tallenna" : "Verify in BC and save"}
                    </button>
                  ) : null}
                </form>
                {canManage && mapping?.external_number ? (
                  <form action={removeBusinessCentralMapping} className="lg:col-start-2">
                    <input type="hidden" name="entityType" value="product" />
                    <input type="hidden" name="localEntityId" value={product.id} />
                    <button className="text-xs font-semibold text-[#8a3b2f] underline underline-offset-4">
                      {fi ? "Poista vastine" : "Remove mapping"}
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
