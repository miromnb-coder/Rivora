import { test, expect } from "@playwright/test";

// Run against an authenticated Preview with a synthetic workspace account.
// The response is mocked so the browser never incurs a paid AI call.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/copilot/ask", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ answer: "Synthetic workflow guidance.", requestId: "copilot-ui-test" }),
  }));
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "AI Copilot" }).filter({ visible: true })).toBeVisible();
});

test("sidebar choice persists and navigation remains usable", async ({ page, isMobile }) => {
  if (isMobile) {
    await expect(page.locator(".app-mobile-bottom-nav")).toBeVisible();
    return;
  }
  await page.getByRole("button", { name: /Pienennä valikko|Collapse sidebar/ }).click();
  await expect(page.locator(".app-shell-v2")).toHaveClass(/is-sidebar-collapsed/);
  await expect(page.getByRole("navigation", { name: /päävalikko|main navigation/ }).first().getByRole("link", { name: /Tilaukset|Orders/ })).toBeVisible();
  await page.reload();
  await expect(page.locator(".app-shell-v2")).toHaveClass(/is-sidebar-collapsed/);
  const account = page.getByRole("button", { name: /Työtili ja tiliasetukset|Workspace and account/ });
  await account.click();
  await expect(page.locator(".app-sidebar-account-menu")).toBeVisible();
  await expect(page.locator(".app-sidebar-account-menu").getByRole("button", { name: /Kirjaudu ulos|Sign out/ })).toBeVisible();
  await page.getByRole("button", { name: /Laajenna valikko|Expand sidebar/ }).click();
});

test("copilot conversation, route change, keyboard and layout", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "AI Copilot" }).filter({ visible: true });
  await trigger.click();
  const panel = page.locator("#sales-copilot");
  await expect(panel).toBeVisible();
  const input = panel.getByRole("textbox", { name: /Kysy AI Copilotilta|Ask AI Copilot/ });
  await input.fill("How do I review a quote?");
  await input.press("Enter");
  await expect(panel.getByText("Synthetic workflow guidance.")).toBeVisible();
  await panel.getByRole("button", { name: /Uusi keskustelu|New conversation/ }).click();
  await expect(panel.getByText("Synthetic workflow guidance.")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bounds = await panel.locator(".sales-copilot-bottom").boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("desktop navigation keeps the copilot open", async ({ page, isMobile }) => {
  test.skip(isMobile, "The phone panel intentionally covers the workspace.");
  await page.setViewportSize({ width: 1680, height: 900 });
  await page.getByRole("button", { name: "AI Copilot" }).filter({ visible: true }).click();
  const panel = page.locator("#sales-copilot");
  await expect(panel).toBeVisible();
  await page.locator(".app-sidebar-v2 a[href='/app/customers']").first().click();
  await expect(page).toHaveURL(/\/app\/customers/);
  await expect(panel).toBeVisible();
});

test("1440px Copilot docks beside workspace without covering or dimming it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "AI Copilot" }).filter({ visible: true }).click();
  const panel = page.getByRole("complementary", { name: "AI Copilot" });
  const main = page.locator(".app-main-v2");
  await expect(panel).toBeVisible();
  const mainBounds = await main.boundingBox();
  const panelBounds = await panel.boundingBox();
  expect(mainBounds).not.toBeNull();
  expect(panelBounds).not.toBeNull();
  expect(mainBounds!.x + mainBounds!.width).toBeLessThanOrEqual(panelBounds!.x + 2);
  await expect(page.locator(".sales-copilot-backdrop")).toHaveCount(0);
  await expect(page.locator(".support-launcher")).toBeHidden();
});

test("1024px uses keyboard-accessible modal rail rather than compressing content", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole("button", { name: "AI Copilot" }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "AI Copilot" });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(page.locator(".sales-copilot-backdrop")).toBeVisible();
  await dialog.getByRole("button", { name: /Sulje AI Copilot|Close AI Copilot/ }).click();
  await expect(dialog).toHaveCount(0);
});

test("small screen uses fullscreen conversation and no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "AI Copilot" }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "AI Copilot" });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(389);
});
