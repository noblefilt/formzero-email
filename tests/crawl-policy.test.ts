import assert from "node:assert/strict"
import test from "node:test"

import { loader as robotsLoader } from "../app/routes/robots.txt"
import { loader as sitemapLoader } from "../app/routes/sitemap.xml"

test("robots policy disables all crawling for the private tool", async () => {
  const response = await robotsLoader({
    request: new Request("https://mail.example.com/robots.txt"),
  })
  const body = await response.text()

  assert.equal(response.status, 200)
  assert.match(body, /User-agent: \*/)
  assert.match(body, /Disallow: \//)
  assert.doesNotMatch(body, /Sitemap:/)
  assert.equal(
    response.headers.get("X-Robots-Tag"),
    "noindex, nofollow, noarchive, nosnippet"
  )
})

test("sitemap does not publish URLs for the private tool", async () => {
  const response = await sitemapLoader({
    request: new Request("https://mail.example.com/sitemap.xml"),
  })
  const body = await response.text()

  assert.equal(response.status, 404)
  assert.match(body, /Sitemap disabled/)
  assert.equal(
    response.headers.get("X-Robots-Tag"),
    "noindex, nofollow, noarchive, nosnippet"
  )
})
