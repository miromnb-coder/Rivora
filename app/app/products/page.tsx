import { products } from "@/lib/demo-data";

const money = new Intl.NumberFormat("en-FI", { style: "currency", currency: "EUR" });

export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="kicker">Catalogue</div>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">Canonical products.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">For the MVP, price and stock can arrive from CSV/Excel. Live ERP reads can be added after matching value is proven.</p>
      <div className="surface mt-7 overflow-hidden">
        <div className="divide-y divide-[var(--line)]">
          {products.map((p) => <div key={p.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1.1fr_2fr_.7fr_.7fr] sm:items-center"><div><div className="text-sm font-extrabold">{p.sku}</div><div className="mt-1 text-xs text-[var(--muted)]">{p.manufacturer}</div></div><div className="text-sm font-semibold">{p.name}</div><div className="text-sm font-bold">{money.format(p.unitPrice)}</div><div className="text-sm"><span className={`status ${p.stock > 20 ? "green" : "amber"}`}>{p.stock} stock</span></div></div>)}
        </div>
      </div>
    </div>
  );
}
