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
  if ((page.viewportSize()?.width ?? 0) >= 1200) {
    await expect(page.locator("#sales-copilot")).toBeVisible();
    await page.locator("#sales-copilot").getByRole("button", { name: /Sulje AI Copilot|Close AI Copilot/ }).click();
  }
});

test("desktop starts with a docked Copilot and keeps AI answers on the pane background", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  const panel = page.locator("#sales-copilot");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Averomira AI Copilot" })).toBeVisible();
  await expect(panel.locator(".sales-copilot-header .sales-copilot-symbol")).toHaveCount(0);
  await panel.getByRole("textbox", { name: /Kysy AI Copilotilta|Ask AI Copilot/ }).fill("Which orders need review?");
  await panel.getByRole("button", { name: /Lähetä viesti|Send message/ }).click();
  const answer = panel.locator(".sales-copilot-message.is-assistant");
  await expect(answer).toContainText("Synthetic workflow guidance.");
  expect(await answer.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  await answer.getByRole("button", { name: /Kopioi vastaus|Copy answer/ }).click();
  await expect(answer.getByText(/Kopioitu|Copied/)).toBeVisible();
});

test("workspace search finds a real route and supports the keyboard shortcut", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press("ControlOrMeta+k");
  const search = page.getByRole("textbox", { name: /Hae sivuja ja toimintoja|Search pages and actions/ });
  await expect(search).toBeFocused();
  const productLabel = await page.locator('.app-sidebar-v2 a[href="/app/products"]').first().textContent();
  await search.fill(productLabel?.trim() || "Products");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/app\/products$/);
});

test("mobile menu exposes secondary routes and account actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Avaa valikko|Open menu/ }).click();
  const menu = page.getByRole("dialog", { name: /Työtilan valikko|Workspace menu/ });
  await expect(menu.getByRole("link", { name: /Tarkistukset|Reviews/ })).toBeVisible();
  await menu.getByRole("button", { name: /Työtili ja tiliasetukset|Workspace and account/ }).click();
  await expect(menu.getByRole("button", { name: /Kirjaudu ulos|Sign out/ })).toBeVisible();
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

test("orders remain usable when the 1440px Copilot is open", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/orders");
  await page.getByRole("button", { name: "AI Copilot" }).filter({ visible: true }).click();
  await expect(page.getByRole("complementary", { name: "AI Copilot" })).toBeVisible();
  await expect(page.locator(".orders-case-table")).toBeVisible();
  await expect(page.locator(".orders-case-table-header")).toBeHidden();
  if (await page.locator(".orders-case-table-row").count()) {
    await expect(page.locator(".orders-case-table-row").first()).toBeVisible();
    await expect(page.locator(".orders-case-table-row").first().locator("strong").first()).toBeVisible();
  }
});

for (const width of [390, 430, 768, 1024, 1280, 1440, 1680, 1920]) {
  test(`${width}px Copilot keeps the composer visible and the workspace usable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.getByRole("button", { name: "AI Copilot" }).filter({ visible: true }).click();
    const panel = page.locator("#sales-copilot");
    await expect(panel).toBeVisible();
    const composer = await panel.locator(".sales-copilot-bottom").boundingBox();
    expect(composer).not.toBeNull();
    expect(composer!.y + composer!.height).toBeLessThanOrEqual(851);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width >= 1200) {
      const main = await page.locator(".app-main-v2").boundingBox();
      const rail = await panel.boundingBox();
      expect(main!.x + main!.width).toBeLessThanOrEqual(rail!.x + 2);
    }
  });
}

test("closing and reopening keeps only the current session conversation", async ({ page, isMobile }) => {
  test.skip(isMobile, "This route transition uses the desktop sidebar.");
  await page.getByRole("button", { name: "AI Copilot" }).filter({ visible: true }).click();
  const panel = page.locator("#sales-copilot");
  const input = panel.getByRole("textbox", { name: /Kysy AI Copilotilta|Ask AI Copilot/ });
  await input.fill("Which RFQs need attention?");
  await input.press("Enter");
  await expect(panel.getByText("Synthetic workflow guidance.")).toBeVisible();
  await panel.getByRole("button", { name: /Sulje AI Copilot|Close AI Copilot/ }).click();
  await page.getByRole("button", { name: "AI Copilot" }).filter({ visible: true }).click();
  await expect(panel.getByText("Synthetic workflow guidance.")).toBeVisible();
  await page.locator(".app-sidebar-v2 a[href='/app/customers']").first().click();
  await expect(panel.getByText("Synthetic workflow guidance.")).toHaveCount(0);
});


test("approved desktop workspace has a flush full-height sidebar and a right-rounded inset card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  const sidebar = page.locator(".app-sidebar-v2");
  const main = page.locator(".app-main-v2");
  const navBounds = await sidebar.boundingBox();
  const cardBounds = await main.boundingBox();
  expect(navBounds).not.toBeNull();
  expect(cardBounds).not.toBeNull();
  expect(navBounds!.y).toBeLessThanOrEqual(1);
  expect(navBounds!.height).toBeGreaterThanOrEqual(899);
  expect(cardBounds!.y).toBeGreaterThanOrEqual(11);
  expect(cardBounds!.y).toBeLessThanOrEqual(13);
  expect(cardBounds!.y + cardBounds!.height).toBeLessThanOrEqual(889);

  const navBackground = await sidebar.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(navBackground).toBe("rgb(255, 255, 255)");
  const shape = await main.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      upperLeft: style.borderTopLeftRadius,
      lowerLeft: style.borderBottomLeftRadius,
      upperRight: style.borderTopRightRadius,
      lowerRight: style.borderBottomRightRadius,
      overflowY: style.overflowY,
    };
  });
  expect(shape).toEqual({
    upperLeft: "0px",
    lowerLeft: "0px",
    upperRight: "16px",
    lowerRight: "16px",
    overflowY: "auto",
  });
  await expect(page.locator("#sales-copilot")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("phone workspace does not inherit desktop card insets or clipped scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const main = page.locator(".app-main-v2");
  const style = await main.evaluate((el) => {
    const css = getComputedStyle(el);
    return { marginTop: css.marginTop, radius: css.borderTopRightRadius };
  });
  expect(style.marginTop).toBe("0px");
  expect(style.radius).toBe("0px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
