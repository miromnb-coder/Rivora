import { test, expect } from "@playwright/test";

// Real protected Preview with an approved synthetic authenticated test account.
// Intercepts paid Support AI calls; never submits customer support tickets.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/support/ask", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        supported: true,
        answer: "Synthetic AI Support 2.1 browser test answer.",
        articleIds: [],
        requestId: "ui-qa-test",
      }),
    });
  });
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /Avaa Averomira Help Center|Open Averomira Help Center/ })).toBeVisible();
  await page.getByRole("button", { name: /Avaa Averomira Help Center|Open Averomira Help Center/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("single AI heading, three suggestions and footer without duplicated advice", async ({ page }) => {
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("heading", { name: "Averomira AI" })).toHaveCount(1);
  await expect(panel.getByText(/Miten voin auttaa\?|How can I help\?/)).toHaveCount(1);
  await expect(panel.getByText(/Miten voimme auttaa\?|How can we help\?/)).toHaveCount(0);
  await expect(panel.locator(".support-s5-prompts button")).toHaveCount(3);
  await expect(panel.locator(".support-ai-card")).toHaveCount(0);
  await expect(panel.locator(".support-context-section")).toHaveCount(0);
  await expect(panel.getByRole("navigation")).toBeVisible();
  await expect(panel.locator(".support-ai-form textarea")).toBeVisible();
});

test("footer composer stays inside drawer at all four viewports", async ({ page }) => {
  const metrics = await page.evaluate(() => {
    const drawer = document.querySelector(".support-center-panel")!.getBoundingClientRect();
    const form = document.querySelector(".support-ai-form")!.getBoundingClientRect();
    const nav = document.querySelector(".support-home-actions")!.getBoundingClientRect();
    return {
      drawerLeft: drawer.left,
      drawerRight: drawer.right,
      drawerBottom: drawer.bottom,
      formTop: form.top,
      formBottom: form.bottom,
      navTop: nav.top,
      navBottom: nav.bottom,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(metrics.overflow).toBe(false);
  expect(metrics.drawerLeft).toBeGreaterThanOrEqual(-1);
  expect(metrics.drawerRight).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.formTop).toBeGreaterThan(0);
  expect(metrics.formBottom).toBeLessThan(metrics.navTop);
  expect(metrics.navBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
});

test("mocked AI works, reset works, help navigation preserves articles", async ({ page }) => {
  const panel = page.getByRole("dialog");
  const composer = panel.locator(".support-ai-form textarea");
  await composer.fill("Miten käsittelen uuden tarjouspyynnön?");
  await panel.getByRole("button", { name: /Lähetä kysymys|Send question/ }).click();
  await expect(panel.getByText("Synthetic AI Support 2.1 browser test answer.")).toBeVisible();
  await panel.getByRole("button", { name: /Uusi keskustelu|New conversation/ }).click();
  await expect(panel.getByText("Synthetic AI Support 2.1 browser test answer.")).toHaveCount(0);
  const nav = panel.getByRole("navigation");
  await nav.getByRole("button", { name: /^(Ohjeet|Help)$/ }).click();
  await expect(panel.getByText(/Kaikki ohjeet|All help articles/)).toBeVisible();
  await panel.getByRole("button", { name: /Takaisin AI-avustajaan|Back to AI assistant/ }).click();
  await expect(panel.getByRole("heading", { name: "Averomira AI" })).toBeVisible();
});

test("keyboard interaction: Shift+Enter adds a line, Enter sends; Escape closes", async ({ page }) => {
  const panel = page.getByRole("dialog");
  const textarea = panel.locator("textarea#support-ai-question");
  await textarea.fill("Ensimmäinen rivi");
  await textarea.press("Shift+Enter");
  await textarea.type("Toinen rivi");
  await expect(textarea).toHaveValue(/Ensimmäinen rivi\nToinen rivi/);
  await textarea.press("Enter");
  await expect(panel.getByText("Synthetic AI Support 2.1 browser test answer.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
});
