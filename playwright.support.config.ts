import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.SUPPORT_PREVIEW_URL;
const storageState = process.env.SUPPORT_PREVIEW_STORAGE_STATE;

// Run only with a reviewed, authenticated test-user storageState. Do not
// commit cookies, credentials or a Vercel protection bypass token to the repo.
if (!baseURL || !storageState) {
  throw new Error("Set SUPPORT_PREVIEW_URL and SUPPORT_PREVIEW_STORAGE_STATE to run protected Support 2.1 browser QA.");
}

export default defineConfig({
  testDir: "./tests",
  testMatch: "support-2-1.browser.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL,
    storageState,
    screenshot: "off", // no customer dashboard screenshots in artifacts
    trace: "off",
    video: "off",
    navigationTimeout: 20_000,
  },
  projects: [
    { name: "phone-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "phone-430", use: { ...devices["Pixel 7"], viewport: { width: 430, height: 932 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 900 } } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
