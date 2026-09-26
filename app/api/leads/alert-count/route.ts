import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/rivora/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, claims, workspace } = await getAuthContext();

  if (!claims || !workspace || !["owner", "admin"].includes(workspace.role)) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("marketing_leads")
    .select("id, notification_read_at, follow_up_on, status")
    .limit(500);

  if (error) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }

  const ids = new Set(
    (data ?? [])
      .filter(
        (lead) =>
          !lead.notification_read_at ||
          (lead.status !== "closed" &&
            typeof lead.follow_up_on === "string" &&
            lead.follow_up_on <= today),
      )
      .map((lead) => lead.id),
  );

  return NextResponse.json(
    { count: ids.size },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    },
  );
}
