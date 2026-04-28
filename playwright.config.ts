import { defineConfig } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4175"
const parsedBaseURL = new URL(baseURL)
const webServerHost = parsedBaseURL.hostname
const webServerPort =
  parsedBaseURL.port || (parsedBaseURL.protocol === "https:" ? "443" : "80")
const disableWebServer = process.env.PLAYWRIGHT_DISABLE_WEBSERVER === "1"
const webServerCommand =
  process.env.PLAYWRIGHT_WEBSERVER_COMMAND ||
  `mkdir -p .wrangler/playwright-home && HOME=$PWD/.wrangler/playwright-home CHOKIDAR_USEPOLLING=1 BETTER_AUTH_BASE_URL=${baseURL} npm run dev -- --host ${webServerHost} --port ${webServerPort}`

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
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: disableWebServer
    ? undefined
    : {
        command: webServerCommand,
        url: `${baseURL}/login`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
