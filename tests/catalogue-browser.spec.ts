import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ExcelJS from "exceljs";

const database = (sql: string) =>
  execFileSync(
    "docker",
    [
      "--host=unix:///var/run/docker.sock",
      "exec",
      "-i",
      "averomira-catalogue-test",
      "psql",
      "-U",
      "postgres",
      "-d",
      "averomira_test",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: sql, encoding: "utf8" },
  );
const org = "20000000-0000-0000-0000-000000000001";
async function login(page: Page, account = 0) {
  const sessions = JSON.parse(
    readFileSync("/tmp/averomira-test-sessions.json", "utf8"),
  );
  await page.context().addCookies([
    {
      name: "sb-localhost-auth-token",
      value:
        "base64-" +
        Buffer.from(JSON.stringify(sessions[account])).toString("base64url"),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
    { name: "averomira-locale", value: "fi", domain: "localhost", path: "/" },
  ]);
  await page.goto("/app/upload");
}
async function upload(page: Page, content: string, name = "synthetic.csv") {
  await page.getByLabel(/Katalogitiedosto/).setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(content),
  });
  await page
    .getByRole("button", { name: "Lue tiedosto ja tunnista sarakkeet" })
    .click();
  await expect(
    page.getByText("Tarkista jokaisen sarakkeen vastaavuus.", { exact: false }),
  ).toBeVisible();
}
test.beforeEach(() => {
  database(`delete from private.catalogue_imports; delete from public.catalogue_field_maps; delete from public.products;
    insert into public.products(organization_id,sku,name,unit_price,stock_quantity) values
    ('${org}','ABC-1','Old valve',10,7),('${org}','KEEP','Retained',20,8),
    ('20000000-0000-0000-0000-000000000002','ABC-1','Other tenant',100,99);`);
});

test("manual mapping, saved maps, AI fallback and default merge reach actual PostgreSQL", async ({
  page,
}) => {
  await login(page);
  await upload(page, "PartRef;MyLabel;CostX\nabc-1;Valve;0\nNEW;Seal;12,34\n");
  await expect(
    page.getByRole("button", { name: "Hyväksy kartta ja näytä muutokset" }),
  ).toBeDisabled();
  await page.getByLabel("Sarakkeen PartRef vastaavuus").selectOption("sku");
  await page.getByLabel("Sarakkeen MyLabel vastaavuus").selectOption("name");
  await page.getByLabel("Sarakkeen CostX vastaavuus").selectOption("unitPrice");
  await page.getByRole("button", { name: "Pyydä AI-kartoitusehdotus" }).click();
  await expect(page.getByRole("status")).toContainText(
    "AI ei ole käytettävissä",
  );
  await page.getByLabel("Kartan nimi").fill("Synthetic ERP");
  await page
    .getByRole("button", { name: "Tallenna vahvistettu kartta" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "tallennettu organisaatiollesi",
  );
  await page
    .getByRole("button", { name: "Hyväksy kartta ja näytä muutokset" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tuonnin yhteenveto" }),
  ).toBeVisible();
  await expect(
    page.getByText("1 uutta tuotetta", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("0 deaktivoitavaa tuotetta", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Vahvista ja tallenna tuonti" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: /Tuonti onnistui/ }),
  ).toBeVisible();
  expect(
    database(
      `select sku||':'||unit_price::text||':'||stock_quantity::text from public.products where organization_id='${org}' and sku='ABC-1'`,
    ),
  ).toContain("ABC-1:0.0000:7.0000");
  expect(
    database(
      `select active from public.products where organization_id='${org}' and sku='KEEP'`,
    ).trim(),
  ).toBe("t");
  expect(
    database(
      "select unit_price from public.products where organization_id='20000000-0000-0000-0000-000000000002'",
    ).trim(),
  ).toBe("100.0000");
  await page.getByRole("button", { name: "Aloita uusi tuonti" }).click();
  await upload(page, "PartRef;MyLabel;CostX\nabc-1;Valve;0\n");
  await expect(page.getByRole("status")).toContainText(
    "Ehdotettu tallennettu kartta",
  );
  await expect(page.getByLabel("Sarakkeen PartRef vastaavuus")).toHaveValue(
    "sku",
  );
  const width = await page.evaluate(() => ({
    body: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(width.body).toBeLessThanOrEqual(width.viewport);
});

test("replacement warning and explicit confirmation; stale preview has no side effects", async ({
  page,
}) => {
  await login(page);
  await upload(page, "SKU;Name;Price\nABC-1;Valve;5\n");
  await page.getByLabel(/Korvaa koko katalogi —/).check();
  await page
    .getByRole("button", { name: "Hyväksy kartta ja näytä muutokset" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Varoitus:" }),
  ).toContainText("1 tuotetta deaktivoidaan");
  await expect(
    page.getByRole("button", { name: "Vahvista ja tallenna tuonti" }),
  ).toBeDisabled();
  database(
    `update public.products set name='Concurrent' where organization_id='${org}' and sku='KEEP'`,
  );
  await page.getByLabel(/Vahvistan koko katalogin/).check();
  await page
    .getByRole("button", { name: "Vahvista ja tallenna tuonti" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Katalogi muuttui" }),
  ).toBeVisible();
  expect(
    database(
      `select active from public.products where organization_id='${org}' and sku='KEEP'`,
    ).trim(),
  ).toBe("t");
  await page.getByRole("button", { name: "Takaisin sarakekarttaan" }).click();
  await page
    .getByRole("button", { name: "Hyväksy kartta ja näytä muutokset" })
    .click();
  await page.getByLabel(/Vahvistan koko katalogin/).check();
  await page
    .getByRole("button", { name: "Vahvista ja tallenna tuonti" })
    .click();
  await expect(
    page.getByRole("heading", { name: /Tuonti onnistui/ }),
  ).toBeVisible();
  expect(
    database(
      `select active from public.products where organization_id='${org}' and sku='KEEP'`,
    ).trim(),
  ).toBe("f");
});

test("invalid price blocks all writes and offers a full error report", async ({
  page,
}) => {
  await login(page);
  await upload(page, "SKU;Name;Price\nABC-1;Valve;sovitaan\nNEW;Seal;3\n");
  await page
    .getByRole("button", { name: "Hyväksy kartta ja näytä muutokset" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "virhettä estää tuonnin" }),
  ).toContainText("1 virhettä estää tuonnin");
  await expect(
    page.getByRole("alert").filter({ hasText: "virhettä estää tuonnin" }),
  ).toContainText("sovitaan");
  expect(
    database(
      `select count(*) from public.products where organization_id='${org}'`,
    ).trim(),
  ).toBe("2");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Lataa virheraportti" }).click();
  expect((await download).suggestedFilename()).toBe("katalogin-virheet.csv");
});

test("large Unicode error report is paged and downloaded in full", async ({
  page,
}) => {
  test.setTimeout(60000);
  await login(page);
  const rows = Array.from(
    { length: 450 },
    (_, i) => `BAD-${i};Valve;${"€".repeat(2000)}`,
  );
  await upload(page, "SKU;Name;Price\n" + rows.join("\n") + "\n");
  await page
    .getByRole("button", { name: "Hyväksy kartta ja näytä muutokset" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "virhettä estää tuonnin" }),
  ).toContainText("450 virhettä estää tuonnin");
  await expect(page.getByText(/Näytetään ensimmäiset/)).toBeVisible();
  let pages = 0;
  page.on("response", (response) => {
    if (response.headers()["x-catalogue-next-offset"] !== undefined) pages++;
  });
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Lataa virheraportti" }).click();
  const download = await pending;
  const csv = readFileSync((await download.path())!, "utf8");
  expect(pages).toBe(2);
  expect(csv.split("€").length - 1).toBe(450 * 2000);
  expect(csv).toContain('"451";"Price"');
  expect(
    database(
      `select count(*) from public.products where organization_id='${org}'`,
    ).trim(),
  ).toBe("2");
});

test("XLSX enters the same guided flow", async ({ page }) => {
  await login(page);
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Catalogue").addRows([
    ["Product No.", "Item Description", "Unit Price"],
    ["XLSX-1", "Synthetic", 2.5],
  ]);
  await page.getByLabel(/Katalogitiedosto/).setInputFiles({
    name: "synthetic.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  await page
    .getByRole("button", { name: "Lue tiedosto ja tunnista sarakkeet" })
    .click();
  await page
    .getByRole("button", { name: "Hyväksy kartta ja näytä muutokset" })
    .click();
  await page
    .getByRole("button", { name: "Vahvista ja tallenna tuonti" })
    .click();
  await expect(
    page.getByRole("heading", { name: /Tuonti onnistui/ }),
  ).toBeVisible();
  expect(
    database(
      `select unit_price from public.products where organization_id='${org}' and sku='XLSX-1'`,
    ).trim(),
  ).toBe("2.5000");
});

test("member access and cross-origin mutations are rejected", async ({
  page,
}) => {
  await login(page, 2);
  await expect(
    page.getByText(
      "Katalogituonti vaatii omistajan tai ylläpitäjän oikeudet.",
      { exact: true },
    ),
  ).toBeVisible();
  const response = await page.request.post("/api/catalogue/import", {
    headers: { Origin: "http://localhost:3000" },
    multipart: {
      action: "commit",
      importId: "50000000-0000-0000-0000-000000000001",
    },
  });
  expect(response.status()).toBe(403);
  const crossOrigin = await page.request.post("/api/catalogue/import", {
    headers: { Origin: "https://untrusted.invalid" },
    multipart: { action: "commit" },
  });
  expect(crossOrigin.status()).toBe(403);
});

test("interrupted upload returns an actionable error without a success notification", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/catalogue/import", (route) =>
    route.request().method() === "POST"
      ? route.abort("connectionfailed")
      : route.continue(),
  );
  await page.getByLabel(/Katalogitiedosto/).setInputFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("SKU;Name\nA;Synthetic\n"),
  });
  await page
    .getByRole("button", { name: "Lue tiedosto ja tunnista sarakkeet" })
    .click();
  await expect(
    page.locator(".catalogue-guided-import [role=alert]"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Tuonti onnistui/ }),
  ).toHaveCount(0);
});

test("paged preview and lost commit response preserve idempotency", async ({
  page,
}) => {
  await login(page);
  const content =
    "SKU;Name;Price\n" +
    Array.from(
      { length: 55 },
      (_, i) => `PAGE-${String(i).padStart(3, "0")};Synthetic ${i};1`,
    ).join("\n");
  await upload(page, content);
  await page
    .getByRole("button", { name: "Hyväksy kartta ja näytä muutokset" })
    .click();
  await expect(page.getByText("Sivu 1 / 2")).toBeVisible();
  await page.getByRole("button", { name: "Seuraava", exact: true }).click();
  await expect(
    page.getByText("PAGE-054 — Lisätään", { exact: true }),
  ).toBeVisible();
  let committedOnce = false;
  await page.route("**/api/catalogue/import", async (route) => {
    if (
      !committedOnce &&
      route.request().method() === "POST" &&
      route.request().postData()?.includes('name="action"\r\n\r\ncommit')
    ) {
      committedOnce = true;
      await route.fetch();
      await route.abort("connectionfailed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Vahvista ja tallenna tuonti" })
    .click();
  await expect(
    page.locator(".catalogue-guided-import [role=alert]"),
  ).toContainText("samalla tunnisteella");
  expect(
    database(
      `select count(*) from public.products where organization_id='${org}' and sku like 'PAGE-%'`,
    ).trim(),
  ).toBe("55");
  await page
    .getByRole("button", { name: "Vahvista ja tallenna tuonti" })
    .click();
  await expect(
    page.getByRole("heading", { name: /Tuonti onnistui/ }),
  ).toBeVisible();
  expect(
    database(
      `select count(*) from public.activity_events where event_type='catalogue_imported' and entity_id in (select id from private.catalogue_imports where organization_id='${org}')`,
    ).trim(),
  ).toBe("1");
});

test("25 000 product catalogue completes through browser, API and SQL", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await login(page);
  const content =
    "SKU;Name;Price\n" +
    Array.from(
      { length: 25000 },
      (_, i) => `LARGE-${i};Synthetic ${i};12,34`,
    ).join("\n");
  await upload(page, content);
  await page
    .getByRole("button", { name: "Hyväksy kartta ja näytä muutokset" })
    .click();
  await expect(
    page.getByText("25000 uutta tuotetta", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Sivu 1 / 500")).toBeVisible();
  await page
    .getByRole("button", { name: "Vahvista ja tallenna tuonti" })
    .click();
  await expect(
    page.getByRole("heading", { name: /Tuonti onnistui/ }),
  ).toBeVisible({ timeout: 30_000 });
  expect(
    database(
      `select count(*) from public.products where organization_id='${org}' and sku like 'LARGE-%'`,
    ).trim(),
  ).toBe("25000");
});
