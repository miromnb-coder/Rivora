import { defineConfig } from "@playwright/test";
export default defineConfig({
  outputDir: "workspace-test-results",
  testDir: "./tests", testMatch: "workspace-browser.spec.ts", workers: 1,
  timeout: 30_000, reporter: [["list"], ["html", { outputFolder: "workspace-report", open: "never" }]],
  use: { baseURL: "http://127.0.0.1:3102", trace: "retain-on-failure" },
  webServer: { command: "node scripts/workspace-ui-server.mjs", url: "http://127.0.0.1:3102", reuseExistingServer: false },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }, { name: "webkit", use: { browserName: "webkit" } }],
});
