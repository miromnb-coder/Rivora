import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type BusinessCentralCompany = {
  id?: string;
  name?: string;
  displayName?: string;
};

export async function GET() {
  const tenantId = process.env.BUSINESS_CENTRAL_TENANT_ID;
  const clientId = process.env.BUSINESS_CENTRAL_CLIENT_ID;
  const clientSecret = process.env.BUSINESS_CENTRAL_CLIENT_SECRET;
  const environment = process.env.BUSINESS_CENTRAL_ENVIRONMENT;

  const missing = [
    ["BUSINESS_CENTRAL_TENANT_ID", tenantId],
    ["BUSINESS_CENTRAL_CLIENT_ID", clientId],
    ["BUSINESS_CENTRAL_CLIENT_SECRET", clientSecret],
    ["BUSINESS_CENTRAL_ENVIRONMENT", environment],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, stage: "configuration", missing },
      { status: 500 },
    );
  }

  try {
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(
        tenantId!,
      )}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          grant_type: "client_credentials",
          scope: "https://api.businesscentral.dynamics.com/.default",
        }),
        cache: "no-store",
      },
    );

    if (!tokenResponse.ok) {
      const detail = (await tokenResponse.text()).slice(0, 800);
      return NextResponse.json(
        {
          ok: false,
          stage: "oauth",
          status: tokenResponse.status,
          detail,
        },
        { status: 502 },
      );
    }

    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) {
      return NextResponse.json(
        { ok: false, stage: "oauth", detail: "No access_token returned" },
        { status: 502 },
      );
    }

    const companiesResponse = await fetch(
      `https://api.businesscentral.dynamics.com/v2.0/${encodeURIComponent(
        tenantId!,
      )}/${encodeURIComponent(environment!)}/api/v2.0/companies`,
      {
        headers: {
          authorization: `Bearer ${token.access_token}`,
          accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!companiesResponse.ok) {
      const detail = (await companiesResponse.text()).slice(0, 1200);
      return NextResponse.json(
        {
          ok: false,
          stage: "companies",
          status: companiesResponse.status,
          environment,
          detail,
        },
        { status: 502 },
      );
    }

    const payload = (await companiesResponse.json()) as {
      value?: BusinessCentralCompany[];
    };

    const companies = (payload.value ?? []).map((company) => ({
      id: company.id,
      name: company.name,
      displayName: company.displayName,
    }));

    return NextResponse.json({
      ok: true,
      environment,
      companyCount: companies.length,
      companies,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        stage: "unexpected",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
