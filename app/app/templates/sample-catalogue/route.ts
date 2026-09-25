export const dynamic = "force-dynamic";

export async function GET() {
  const csv = [
    "sku,name,manufacturer,manufacturer_part_number,unit,unit_price,stock_quantity",
    "PUMP-ALPHA2-2560,ALPHA2 circulation pump,Grundfos,98561418,pcs,285.00,24",
    "VALVE-DN25,Brass ball valve DN25,Nodra Demo,V-DN25,pcs,18.90,110",
    "SENSOR-PT100,PT100 temperature sensor,Nodra Demo,PT100-150,pcs,42.50,36",
    "FILTER-10M,Inline filter 10 micron,Nodra Demo,F10-025,pcs,12.75,85",
    "MOTOR-075,Three-phase motor 0.75 kW,Nodra Demo,M075-400,pcs,196.00,12",
  ].join("\n");

  return new Response(csv + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nodra-sample-catalogue.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
