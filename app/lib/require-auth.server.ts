import { redirect } from "react-router"
import { getAuth } from "~/lib/auth.server"

/**
 * Requires authentication for a route. Redirects to /login if not authenticated.
 * Returns the authenticated user.
 */
export async function requireAuth(request: Request, db: D1Database, env?: unknown) {
  const auth = getAuth({
    database: db,
    baseURL: new URL(request.url).origin,
    env,
  })
  const session = await auth.api.getSession({
    headers: request.headers
  })

  if (!session?.user) {
    throw redirect("/login")
  }

  return session.user
}
