import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "copilot-browser.spec.ts",
  timeout: 20_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:3200" },
  webServer: {
    command: "node scripts/copilot-ui-server.mjs",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: false,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
});
