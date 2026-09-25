export const dynamic = "force-dynamic";

export async function GET() {
  const csv = [
    "sku,name,manufacturer,manufacturer_part_number,unit,unit_price,stock_quantity",
    "YOUR-SKU-001,Product name,Manufacturer,MPN-001,pcs,0.00,0",
  ].join("\n");

  return new Response(csv + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nodra-catalogue-template.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
