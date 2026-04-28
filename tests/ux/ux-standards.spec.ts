import { expect, test, type Page } from "@playwright/test"

import {
  MIN_UNDO_HISTORY_STEPS,
  UX_ATTRS,
  UX_AUTOSAVE_STATES,
  UX_FEEDBACK_STATES,
} from "../../src/ui/ux-standards"

const editorUrl = process.env.UX_STANDARDS_URL || "/editor"
const authEmail =
  process.env.PLAYWRIGHT_AUTH_EMAIL || "playwright-editor@example.com"
const authPassword =
  process.env.PLAYWRIGHT_AUTH_PASSWORD || "Playwright123!"
const authName = process.env.PLAYWRIGHT_AUTH_NAME || "Playwright UX"
const feedbackActionSelector =
  process.env.UX_FEEDBACK_ACTION_SELECTOR ||
  `[${UX_ATTRS.action}="export-html"]`
const validationActionSelector =
  process.env.UX_VALIDATION_ACTION_SELECTOR ||
  `[${UX_ATTRS.action}="export-html"]`
const feedbackSelector =
  process.env.UX_FEEDBACK_SELECTOR || `[${UX_ATTRS.feedback}]`
const dragSourceSelector =
  process.env.UX_DRAG_SOURCE_SELECTOR || `[${UX_ATTRS.dragSource}]`
const dropPlaceholderSelector =
  process.env.UX_DROP_PLACEHOLDER_SELECTOR || `[${UX_ATTRS.dropPlaceholder}]`
const autosaveInputSelector =
  process.env.UX_AUTOSAVE_INPUT_SELECTOR || "[data-ux-autosave-input]"
const autosaveStatusSelector =
  process.env.UX_AUTOSAVE_STATUS_SELECTOR || `[${UX_ATTRS.autosaveStatus}]`
const validationSelector =
  process.env.UX_VALIDATION_SELECTOR || `[${UX_ATTRS.validation}]`
const emptyStateSelector =
  process.env.UX_EMPTY_STATE_SELECTOR || `[${UX_ATTRS.emptyState}]`
const emptyCtaSelector =
  process.env.UX_EMPTY_CTA_SELECTOR || `[${UX_ATTRS.emptyCta}]`
const cancelSelector = process.env.UX_CANCEL_SELECTOR || `[${UX_ATTRS.cancel}]`
const retrySelector = process.env.UX_RETRY_SELECTOR || `[${UX_ATTRS.retry}]`
const historySelector =
  process.env.UX_HISTORY_SELECTOR || `[${UX_ATTRS.historyCapacity}]`

async function submitAuthForm(page: Page) {
  if (page.url().includes("/signup")) {
    await page.getByLabel("姓名").fill(authName)
    await page.getByLabel("邮箱").fill(authEmail)
    await page.getByLabel("密码").fill(authPassword)
    await page.getByLabel("确认密码").fill(authPassword)
    await page.getByRole("button", { name: /创建账户|创建中/ }).click()
    await page.waitForURL(/\/forms\/dashboard/, { timeout: 15_000 })
    return
  }

  if (page.url().includes("/login")) {
    await page.getByLabel("邮箱").fill(authEmail)
    await page.getByLabel("密码").fill(authPassword)
    await page.getByRole("button", { name: /登录|登录中/ }).click()

    const invalidCredentials = page.getByText("邮箱或密码错误")
    await Promise.race([
      page.waitForURL(/\/forms\/dashboard/, { timeout: 15_000 }),
      invalidCredentials.waitFor({ state: "visible", timeout: 15_000 }),
    ])

    if (await invalidCredentials.isVisible().catch(() => false)) {
      throw new Error(
        "Playwright could not authenticate into FormZero. Set PLAYWRIGHT_AUTH_EMAIL and PLAYWRIGHT_AUTH_PASSWORD to a valid existing account, or run against a fresh local database."
      )
    }
  }
}

async function ensureEditorReady(page: Page) {
  await page.goto(editorUrl)
  await page.waitForLoadState("domcontentloaded")

  if (page.url().includes("/login") || page.url().includes("/signup")) {
    await submitAuthForm(page)
    await page.goto(editorUrl)
  }

  await expect(page).toHaveURL(/\/editor/)
  await expect(page.locator(autosaveInputSelector).first()).toBeVisible()
}

test.describe("UX standards contract @ux-standards", () => {
  test.describe.configure({ mode: "serial" })

  test.beforeEach(async ({ page }) => {
    await ensureEditorReady(page)
  })

  test("click feedback appears within 16ms", async ({ page }) => {
    const action = page.locator(feedbackActionSelector).first()
    const feedback = page.locator(feedbackSelector).first()

    await expect(action).toBeVisible()
    await expect(action).toBeEnabled()
    await expect(feedback).toBeVisible()

    const elapsed = await page.evaluate(
      async ({ actionSelector: selector, feedbackSelector: statusSelector }) => {
        const actionNode = document.querySelector<HTMLElement>(selector)
        const feedbackNode = document.querySelector<HTMLElement>(statusSelector)

        if (!actionNode || !feedbackNode) {
          throw new Error("Missing UX action or feedback hook.")
        }

        const start = performance.now()
        actionNode.click()

        return await new Promise<number>((resolve, reject) => {
          const deadline = start + 32

          const tick = () => {
            const state = feedbackNode.getAttribute("data-ux-feedback")
            if (state && state !== "idle") {
              resolve(performance.now() - start)
              return
            }

            if (performance.now() > deadline) {
              reject(
                new Error("No visible feedback state was exposed within 16ms.")
              )
              return
            }

            requestAnimationFrame(tick)
          }

          requestAnimationFrame(tick)
        })
      },
      {
        actionSelector: feedbackActionSelector,
        feedbackSelector,
      }
    )

    expect(elapsed).toBeLessThanOrEqual(16)
    await expect(feedback).toHaveAttribute(
      UX_ATTRS.feedback,
      new RegExp(UX_FEEDBACK_STATES.join("|"))
    )
  })

  test("dragging shows a placeholder without canvas jump", async ({ page }) => {
    const dragSource = page.locator(dragSourceSelector).first()
    const placeholder = page.locator(dropPlaceholderSelector).first()

    await expect(dragSource).toBeVisible()

    const before = await dragSource.boundingBox()
    if (!before) {
      throw new Error("Unable to read drag source layout before dragging.")
    }

    await dragSource.hover()
    await page.mouse.down()
    await page.mouse.move(before.x + 24, before.y + 24, { steps: 8 })

    await expect(placeholder).toBeVisible()

    const after = await dragSource.boundingBox()
    if (!after) {
      throw new Error("Unable to read drag source layout during dragging.")
    }

    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(4)
    await page.mouse.up()
  })

  test("editing autosaves without a manual save button", async ({ page }) => {
    const input = page.locator(autosaveInputSelector).first()
    const status = page.locator(autosaveStatusSelector).first()

    await expect(input).toBeVisible()
    await expect(status).toBeVisible()
    await expect(page.locator("[data-ux-manual-save]")).toHaveCount(0)

    await input.fill(`Autosave ${Date.now()}`)

    await expect(status).toHaveAttribute(
      UX_ATTRS.autosaveStatus,
      /saving|saved/
    )
    await expect(status).toHaveAttribute(
      UX_ATTRS.autosaveStatus,
      new RegExp(UX_AUTOSAVE_STATES.join("|"))
    )
  })

  test("validation is real-time and blocks invalid submission", async ({ page }) => {
    const validation = page.locator(validationSelector).first()
    const subjectInput = page.locator(autosaveInputSelector).first()
    const action = page.locator(validationActionSelector).first()

    await expect(validation).toBeVisible()
    await expect(action).toBeEnabled()

    await subjectInput.fill("")

    await expect(validation).toContainText(/主题|subject/i)
    await expect(action).toBeDisabled()
  })

  test("undo history supports at least 50 steps", async ({ page }) => {
    const history = page.locator(historySelector).first()

    await expect(history).toBeVisible()

    const capacity = Number(await history.getAttribute(UX_ATTRS.historyCapacity))
    expect(capacity).toBeGreaterThanOrEqual(MIN_UNDO_HISTORY_STEPS)
  })

  test("async flows expose cancel or retry controls", async ({ page }) => {
    const cancel = page.locator(cancelSelector)
    const retry = page.locator(retrySelector)

    const cancelCount = await cancel.count()
    const retryCount = await retry.count()

    expect(cancelCount + retryCount).toBeGreaterThan(0)
  })

  test("empty states always include guidance and CTA", async ({ page }) => {
    const emptyState = page.locator(emptyStateSelector).first()
    const emptyCta = page.locator(emptyCtaSelector).first()

    await expect(emptyState).toBeVisible()
    await expect(emptyState).toContainText(/\S+/)
    await expect(emptyCta).toBeVisible()
  })
})
