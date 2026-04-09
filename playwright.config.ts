import { defineConfig } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173"
const disableWebServer = process.env.PLAYWRIGHT_DISABLE_WEBSERVER === "1"

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: disableWebServer
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 4173",
        url: `${baseURL}/login`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
