import { expect, test, type Page } from "@playwright/test"

const authEmail =
  process.env.PLAYWRIGHT_AUTH_EMAIL || "playwright-editor@example.com"
const authPassword =
  process.env.PLAYWRIGHT_AUTH_PASSWORD || "Playwright123!"
const authName = process.env.PLAYWRIGHT_AUTH_NAME || "Playwright UX"

async function submitAuthForm(page: Page) {
  if (page.url().includes("/signup")) {
    await page.getByLabel("姓名").fill(authName)
    await page.getByLabel("邮箱").fill(authEmail)
    await page.getByLabel("密码").fill(authPassword)
    await page.getByLabel("确认密码").fill(authPassword)
    await page.getByRole("button", { name: /创建账户|创建中/ }).click()
    return
  }

  if (page.url().includes("/login")) {
    await page.getByLabel("邮箱").fill(authEmail)
    await page.getByLabel("密码").fill(authPassword)
    await page.getByRole("button", { name: /登录|登录中/ }).click()
    return
  }
}

async function ensureAuthenticated(page: Page) {
  await page.goto("/login")
  await page.waitForLoadState("domcontentloaded")

  if (page.url().includes("/signup") || page.url().includes("/login")) {
    await submitAuthForm(page)
    await page.waitForURL(/\/(setup|forms\/dashboard|forms\/[^/]+\/submissions)/, {
      timeout: 15_000,
    })
  }
}

async function ensureFormReady(page: Page) {
  const formName = `Playwright Integration ${Date.now()}`

  if (page.url().includes("/setup")) {
    await page.getByLabel("表单名称").fill(formName)
    await page.getByRole("button", { name: /创建表单|创建中/ }).click()
    await page.waitForURL(/\/forms\/[^/]+\/submissions/, { timeout: 15_000 })
    return
  }

  if (page.url().includes("/forms/dashboard")) {
    await page.getByRole("button", { name: "新建表单" }).click()
    await page.getByLabel("表单名称").fill(formName)
    await page.getByRole("button", { name: /创建表单|创建中/ }).last().click()
    await page.waitForURL(/\/forms\/[^/]+\/submissions/, { timeout: 15_000 })
  }
}

test("integration page shows complete examples and the simplified account menu", async ({
  page,
}) => {
  await ensureAuthenticated(page)
  await ensureFormReady(page)

  await expect(page.getByRole("link", { name: "提交数据" })).toBeVisible()
  await expect(page.getByRole("link", { name: "集成" })).toBeVisible()
  await expect(page.getByRole("button", { name: "新建表单" })).toBeVisible()

  await page.getByRole("link", { name: "集成" }).click()
  await page.waitForURL(/\/forms\/[^/]+\/integration/, { timeout: 15_000 })

  await expect(
    page.getByRole("heading", { name: "Integration Examples" })
  ).toBeVisible()
  await expect(page.getByText("Use your site's language")).toBeVisible()
  await expect(page.getByRole("button", { name: "Copy" }).first()).toBeVisible()
  await expect(page.getByRole("heading", { name: "Idempotency-Key" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Server Token" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Webhook Signing" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Webhook Delivery Log" })).toBeVisible()
  await expect(page.getByText("默认会预填当前站点 domain")).toBeVisible()
  await expect(page.getByRole("tab", { name: "Server" })).toBeVisible()
  await expect(page.getByText("旧表单不需要额外配置 Server Token")).toBeVisible()

  const codeBlock = page.locator("pre").first()
  await expect(codeBlock).toContainText("_gotcha")
  await expect(codeBlock).toContainText("_redirect")
  await expect(codeBlock).not.toContainText("反垃圾邮件")

  await expect(page.getByText(authName, { exact: true })).toHaveCount(0)
  await expect(page.getByText(authEmail, { exact: true })).toHaveCount(0)
})
