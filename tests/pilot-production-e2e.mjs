import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const BASE_URL = process.env.E2E_BASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.E2E_EMAIL || "nodra.verkkosivut+pilot-e2e2@gmail.com";

if (!BASE_URL || !SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing E2E environment.");
}

const password = "NodraE2E!" + crypto.randomBytes(18).toString("base64url");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const signup = await supabase.auth.signUp({ email: EMAIL, password });
if (signup.error && !/already registered/i.test(signup.error.message)) {
  throw new Error("E2E signup failed: " + signup.error.message);
}
console.log("E2E_SIGNUP_CREATED");

let signedIn = false;
for (let attempt = 0; attempt < 120; attempt += 1) {
  const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password });
  if (!error) {
    signedIn = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
if (!signedIn) throw new Error("E2E user was not confirmed within 10 minutes.");
console.log("E2E_AUTH_READY");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "en-US" });
const page = await context.newPage();
const consoleErrors = [];

page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

async function settle() {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(700);
}

async function clickAndSettle(locator) {
  await locator.click();
  await settle();
}

try {
  await page.goto(BASE_URL + "/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(app|onboarding)(?:\/|$)/, { timeout: 15000 });
  await settle();

  await page.goto(BASE_URL + "/onboarding", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="workspaceName"]').fill("Nodra Pilot E2E");
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="passwordConfirm"]').fill(password);
  await clickAndSettle(page.getByRole("button", { name: /create|luo/i }));
  if (!page.url().includes("/app/setup")) throw new Error("Onboarding did not reach setup: " + page.url());
  console.log("PASS onboarding");

  await page.goto(BASE_URL + "/app/settings", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="name"]').fill("Nodra Pilot E2E");
  await page.locator('input[name="email"]').fill("sales@example.com");
  await page.locator('input[name="addressLine1"]').fill("E2E Street 1");
  await page.locator('input[name="postalCode"]').fill("33100");
  await page.locator('input[name="city"]').fill("Tampere");
  await page.locator('input[name="country"]').fill("Finland");
  await clickAndSettle(page.locator('form:has(input[name="addressLine1"]) button').first());
  if (!page.url().includes("saved=")) throw new Error("Company settings did not save: " + page.url());
  console.log("PASS company settings");

  const catalogue = [
    "sku,name,manufacturer,mpn,unit,price,stock",
    "E2E-001,E2E Test Product A,Nodra Test,MPN-E2E-001,pcs,12.50,100",
    "E2E-002,E2E Test Product B,Nodra Test,MPN-E2E-002,pcs,19.90,50",
  ].join("\n");

  await page.goto(BASE_URL + "/app/upload", { waitUntil: "domcontentloaded" });
  const catalogueInput = page.locator('input[name="catalogue"]');
  await catalogueInput.setInputFiles({
    name: "e2e-catalogue.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(catalogue),
  });
  await clickAndSettle(catalogueInput.locator("xpath=ancestor::form").locator("button").first());
  if (!page.url().includes("catalogueImported=")) throw new Error("Catalogue import did not complete: " + page.url());
  console.log("PASS catalogue import");

  await page.goto(BASE_URL + "/app/customers", { waitUntil: "domcontentloaded" });
  const createCustomerForm = page.locator('form:has(input[name="externalId"])');
  await createCustomerForm.locator('input[name="name"]').fill("E2E Customer");
  await createCustomerForm.locator('input[name="externalId"]').fill("E2E-CUST-001");
  await createCustomerForm.locator('input[name="emailDomain"]').fill("resend.dev");
  await clickAndSettle(createCustomerForm.locator("button").first());
  if (!page.url().includes("/app/customers/")) throw new Error("Customer create failed: " + page.url());

  const contactForm = page.locator('form:has(input[name="isPrimary"])');
  await contactForm.locator('input[name="name"]').fill("E2E Buyer");
  await contactForm.locator('input[name="email"]').fill("delivered@resend.dev");
  await contactForm.locator('input[name="title"]').fill("Buyer");
  await contactForm.locator('input[name="isPrimary"]').check();
  await clickAndSettle(contactForm.locator("button").first());
  console.log("PASS customer and contact");

  const rfq = [
    "customer sku,description,quantity,unit",
    "E2E-001,E2E requested product A,3,pcs",
    "E2E-002,E2E requested product B,2,pcs",
  ].join("\n");

  await page.goto(BASE_URL + "/app/upload", { waitUntil: "domcontentloaded" });
  const rfqForm = page.locator('form:has(input[name="customerName"])');
  await rfqForm.locator('input[name="customerName"]').fill("E2E Customer");
  await rfqForm.locator('input[name="reference"]').fill("RFQ-E2E-PRODUCTION");
  const rfqInput = rfqForm.locator('input[name="rfq"]');
  await rfqInput.setInputFiles({
    name: "e2e-rfq.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(rfq),
  });
  await clickAndSettle(rfqForm.locator("button").first());
  if (!page.url().includes("/app/rfq/")) throw new Error("RFQ create failed: " + page.url());
  console.log("PASS RFQ import and matching");

  for (let guard = 0; guard < 10; guard += 1) {
    await settle();
    const forms = page.locator("form.rfq-review-v2-form");
    const count = await forms.count();
    if (!count) break;
    await clickAndSettle(forms.first().locator("button"));
  }
  if ((await page.locator("form.rfq-review-v2-form").count()) !== 0) {
    throw new Error("RFQ lines remain unconfirmed.");
  }
  console.log("PASS human match confirmation and customer memory");

  const createQuoteForm = page.locator(".rfq-review-v2-ready form");
  if ((await createQuoteForm.count()) !== 1) throw new Error("Quote creation gate not ready.");
  await clickAndSettle(createQuoteForm.locator("button"));
  if (!page.url().includes("/app/quotes/")) throw new Error("Quote creation failed: " + page.url());
  console.log("PASS quote creation");

  const recipientForm = page.locator('form:has(input[name="recipientEmail"])');
  await recipientForm.locator('input[name="recipientName"]').fill("Resend E2E");
  await recipientForm.locator('input[name="recipientEmail"]').fill("delivered@resend.dev");
  await clickAndSettle(recipientForm.locator("button").first());
  console.log("PASS recipient");

  const pdfHref = await page.locator('a[href$="/pdf"]').first().getAttribute("href");
  if (!pdfHref) throw new Error("PDF link missing.");
  const pdfResponse = await context.request.get(new URL(pdfHref, BASE_URL).toString());
  const pdfBytes = await pdfResponse.body();
  const contentType = pdfResponse.headers()["content-type"] || "";
  if (!pdfResponse.ok() || !contentType.includes("application/pdf") || pdfBytes.subarray(0, 4).toString() !== "%PDF") {
    throw new Error("Customer PDF response invalid.");
  }
  console.log("PASS PDF");

  await clickAndSettle(page.getByRole("button", { name: /mark ready/i }));
  await clickAndSettle(page.getByRole("button", { name: /approve quote/i }));
  console.log("PASS pricing/state/approval");

  await clickAndSettle(page.getByRole("button", { name: /^send quote/i }));
  console.log("PASS quote email accepted");

  let delivered = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await page.reload({ waitUntil: "domcontentloaded" });
    const body = (await page.locator("body").innerText()).toLowerCase();
    if (body.includes("delivered")) {
      delivered = true;
      break;
    }
    await page.waitForTimeout(5000);
  }
  if (!delivered) throw new Error("Delivery webhook did not reach delivered state within 5 minutes.");
  console.log("PASS delivery webhook");

  await page.goto(BASE_URL + "/app/setup", { waitUntil: "domcontentloaded" });
  const setupBody = (await page.locator("body").innerText()).toLowerCase();
  if (!setupBody.includes("4/4")) throw new Error("First-run setup did not become 4/4 complete.");
  console.log("PASS first-run completion");

  await page.goto(BASE_URL + "/app/customers", { waitUntil: "domcontentloaded" });
  if (!(await page.locator("body").innerText()).includes("E2E Customer")) {
    throw new Error("Customer history missing after completed flow.");
  }
  console.log("PASS history");

  if (consoleErrors.length) {
    console.log("BROWSER_CONSOLE_ERRORS=" + JSON.stringify(consoleErrors));
  }
  console.log("PRODUCTION_E2E_PASS");
} finally {
  await browser.close();
}
