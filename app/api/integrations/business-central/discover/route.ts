import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// Redeploy marker: refresh Preview environment snapshot after Client ID and Workspace ID.

type Company = {
  id?: string;
  name?: string;
  displayName?: string;
};

function required(name: string) {
  return process.env[name]?.trim() ?? "";
}

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Preview-only endpoint." }, { status: 404 });
  }

  const tenantId = required("BUSINESS_CENTRAL_TENANT_ID");
  const clientId = required("BUSINESS_CENTRAL_CLIENT_ID");
  const clientSecret = required("BUSINESS_CENTRAL_CLIENT_SECRET");
  const environment = required("BUSINESS_CENTRAL_ENVIRONMENT");
  const companyId = required("BUSINESS_CENTRAL_COMPANY_ID");

  const missing = [
    !tenantId && "BUSINESS_CENTRAL_TENANT_ID",
    !clientId && "BUSINESS_CENTRAL_CLIENT_ID",
    !clientSecret && "BUSINESS_CENTRAL_CLIENT_SECRET",
    !environment && "BUSINESS_CENTRAL_ENVIRONMENT",
    !companyId && "BUSINESS_CENTRAL_COMPANY_ID",
  ].filter((value): value is string => Boolean(value));

  if (missing.length) {
    return NextResponse.json({ ok: false, stage: "configuration", missing }, { status: 500 });
  }

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: "https://api.businesscentral.dynamics.com/.default",
      }),
      cache: "no-store",
    },
  );

  const tokenPayload = (await tokenResponse.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    return NextResponse.json(
      {
        ok: false,
        stage: "oauth",
        status: tokenResponse.status,
        error: tokenPayload.error ?? null,
        detail: tokenPayload.error_description?.slice(0, 500) ?? null,
      },
      { status: 502 },
    );
  }

  const companiesResponse = await fetch(
    `https://api.businesscentral.dynamics.com/v2.0/${encodeURIComponent(tenantId)}/${encodeURIComponent(environment)}/api/v2.0/companies`,
    {
      headers: {
        authorization: `Bearer ${tokenPayload.access_token}`,
        accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const companiesPayload = (await companiesResponse.json().catch(() => ({}))) as {
    value?: Company[];
    error?: { message?: string };
  };

  if (!companiesResponse.ok) {
    return NextResponse.json(
      {
        ok: false,
        stage: "companies",
        status: companiesResponse.status,
        detail: companiesPayload.error?.message?.slice(0, 700) ?? null,
      },
      { status: 502 },
    );
  }

  const root = `https://api.businesscentral.dynamics.com/v2.0/${encodeURIComponent(tenantId)}/${encodeURIComponent(environment)}/api/v2.0/companies(${encodeURIComponent(companyId)})`;
  const customerResponse = await fetch(
    `${root}/customers?$top=1&$select=id,number,displayName`,
    {
      headers: {
        authorization: `Bearer ${tokenPayload.access_token}`,
        accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const customerPayload = (await customerResponse.json().catch(() => ({}))) as {
    value?: Array<{ id?: string; number?: string; displayName?: string }>;
    error?: { message?: string };
  };

  if (!customerResponse.ok) {
    return NextResponse.json(
      {
        ok: false,
        stage: "company-access",
        status: customerResponse.status,
        detail: customerPayload.error?.message?.slice(0, 700) ?? null,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    environment,
    companyId,
    companies: (companiesPayload.value ?? []).map(({ id, name, displayName }) => ({
      id,
      name,
      displayName,
    })),
    companyAccess: {
      ok: true,
      customerReadSucceeded: true,
      sampleCustomerCount: customerPayload.value?.length ?? 0,
    },
  });
}
