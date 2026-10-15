declare const __FIXTURE_PAGE__: string;
const records = Array.from({ length: 65 }, (_, index) => ({
  id: `synthetic-rfq-${index}`, reference: `SYNTHETIC-PO-${index}-` + "1234567890".repeat(5),
  status: index % 3 ? "received" : "needs_review", received_at: "2026-10-15T08:00:00Z",
  customers: { id: `synthetic-customer-${index}`, name: `Esimerkki Teollisuus ${index} Oy` },
}));
export async function requireWorkspace() {
  return { workspace: { id: "fixture-a", role: "owner" }, supabase: {
    from(table: string) {
      const samples = Array.from({ length: 8 }, (_, index) => ({
        id: `synthetic-${index}`, name: `Synteettinen pitkä teollisuustuote tai asiakas ${index}`, sku: "PRODUCT-" + "AB1234567890".repeat(8),
        manufacturer: "Esimerkkivalmistaja", manufacturer_part_number: "MPN-" + "1234567890".repeat(6), unit: "kpl", unit_price: 125.50, stock_quantity: 32,
        external_id: "CUSTOMER-" + "1234567890".repeat(6), email_domain: "example.invalid",
        quote_number: `Q-${index}-` + "1234567890".repeat(5), status: "draft", currency: "EUR", created_at: "2026-10-15T08:00:00Z", updated_at: "2026-10-15T08:00:00Z", valid_until: "2026-10-30",
        customers: { name: "Synteettinen Asiakas Oy" }, rfqs: { reference: "SYNTHETIC-REFERENCE" }, quote_lines: [{ line_total: 125.5 }],
      }));
      const tableForPage: Record<string, string> = { products: "products", customers: "customers", quotes: "quotes", inbox: "rfqs", orders: "rfqs" };
      const data = table === tableForPage[__FIXTURE_PAGE__] ? table === "rfqs" ? records : samples : [];
      const result = { data, count: data.length, error: null };
      const chain: Record<string, unknown> = {};
      for (const key of ["select", "eq", "in", "order", "limit"]) chain[key] = () => chain;
      chain.then = (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve);
      return chain;
    },
  } };
}
