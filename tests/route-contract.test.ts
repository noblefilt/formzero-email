import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { basename, extname, join } from "node:path"

import routes from "../app/routes"

type RouteEntry = {
  file?: string
  path?: string
  index?: boolean
  children?: RouteEntry[]
}

function flattenRoutes(entries: RouteEntry[]): RouteEntry[] {
  return entries.flatMap((entry) => [
    entry,
    ...flattenRoutes(entry.children ?? []),
  ])
}

const registeredRoutes = flattenRoutes(routes as RouteEntry[])
const registeredFiles = new Set(
  registeredRoutes.flatMap((route) => (route.file ? [route.file] : []))
)
const registeredPaths = new Set(
  registeredRoutes.flatMap((route) => (route.path ? [route.path] : []))
)

const routeDir = join(process.cwd(), "app", "routes")
const typedRouteFiles = readdirSync(routeDir)
  .filter((file) => [".ts", ".tsx"].includes(extname(file)))
  .filter((file) =>
    readFileSync(join(routeDir, file), "utf8").includes("./+types/")
  )
  .map((file) => `routes/${basename(file)}`)

for (const file of typedRouteFiles) {
  assert(
    registeredFiles.has(file),
    `${file} imports generated route types but is not registered in app/routes.ts`
  )
}

for (const path of ["/editor", "spam", "/robots.txt", "/sitemap.xml", "*"]) {
  assert(
    registeredPaths.has(path),
    `app/routes.ts must register ${path} so production requests do not fall into React Router's unmatched-route error path`
  )
}
