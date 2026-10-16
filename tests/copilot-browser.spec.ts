import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

test.beforeEach(async ({ page }) => {
  await page.request.post("/__reset");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mitä haluaisit selvittää?" })).toBeVisible();
});

test("real UI consumes fragmented UTF-8/SSE and retains Minimal Linen layout", async ({ page }) => {
  const field = page.getByRole("textbox", { name: "Kysy Copilotilta" });
  await field.fill("STREAM TEST");
  await field.press("Enter");
  await expect(page.getByText("Testivastaus: STREAM TEST 💡")).toBeVisible();
  await expect(page.getByText("Vastaus valmis")).toBeVisible();
  await expect(page.locator(".ml-copilot-transcript")).toHaveAttribute("aria-busy", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Shift+Enter keeps composing; Enter sends and New clears history", async ({ page }) => {
  const field = page.getByRole("textbox", { name: "Kysy Copilotilta" });
  await field.fill("Rivi yksi");
  await field.press("Shift+Enter");
  await field.type("Rivi kaksi");
  await expect(field).toHaveValue("Rivi yksi\nRivi kaksi");
  await field.press("Enter");
  await expect(page.getByText("Vastaus valmis")).toBeVisible();
  await expect(page.locator(".ml-copilot-message-user .ml-copilot-message-text")).toHaveText("Rivi yksi\nRivi kaksi");
  await page.getByRole("button", { name: "Aloita uusi keskustelu" }).click();
  await expect(page.locator(".ml-copilot-message")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Mitä haluaisit selvittää?" })).toBeVisible();
});

test("Stop aborts response, and a new conversation cannot receive stale chunks", async ({ page }) => {
  const field = page.getByRole("textbox", { name: "Kysy Copilotilta" });
  await field.fill("PYSÄYTYS");
  await field.press("Enter");
  await expect(page.getByText("Alku", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pysäytä vastaus" }).click();
  await expect(page.getByText("Vastaus pysäytetty")).toBeVisible();
  await page.getByRole("button", { name: "Aloita uusi keskustelu" }).click();
  await expect(page.locator(".ml-copilot-message")).toHaveCount(0);
});

test("A stream failure has inline retry without duplicating the user's turn", async ({ page }) => {
  const field = page.getByRole("textbox", { name: "Kysy Copilotilta" });
  await field.fill("VIRHE");
  await field.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Synteettinen virhe");
  await page.getByRole("button", { name: /Yritä uudelleen/ }).click();
  await expect(page.getByText("Vastaus valmis")).toBeVisible();
  await expect(page.getByText("Testivastaus: VIRHE 💡")).toBeVisible();
  await expect(page.locator(".ml-copilot-message-user")).toHaveCount(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("Disabled backend and broken stream show truthful errors without pretending completion", async ({ page }) => {
  const field = page.getByRole("textbox", { name: "Kysy Copilotilta" });
  await field.fill("POIS");
  await field.press("Enter");
  await expect(page.getByRole("alert")).toContainText("ei ole vielä käytössä");
  await expect(page.getByText("Vastaus valmis")).toHaveCount(0);
  await page.getByRole("button", { name: "Aloita uusi keskustelu" }).click();
  await field.fill("KESKEN");
  await field.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Vastaus katkesi kesken");
  await expect(page.getByText("Vastaus valmis")).toHaveCount(0);
});


test("synthetic Minimal Linen screenshots are captured for visual review", async ({ page }, testInfo) => {
  const field = page.getByRole("textbox", { name: "Kysy Copilotilta" });
  await field.fill("Miten jäsennän seuraavat työvaiheet?");
  await field.press("Enter");
  await expect(page.getByText("Vastaus valmis")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  mkdirSync("test-results/copilot-visual", { recursive: true });
  await page.screenshot({
    path: "test-results/copilot-visual/" + testInfo.project.name + ".png",
    fullPage: true,
  });
});
