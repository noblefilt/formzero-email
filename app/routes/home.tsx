import { redirect } from "react-router"
import type { Route } from "./+types/home"
import { getAuth } from "#/lib/auth.server"

export async function loader({ context, request }: Route.LoaderArgs) {
  const database = context.cloudflare.env.DB;
  const auth = getAuth({
      database,
      baseURL: new URL(request.url).origin,
      env: context.cloudflare.env,
  });

  // Redirect to app if already logged in
  const session = await auth.api.getSession({
      headers: request.headers
  });
  if (session?.user) {
    return redirect("/forms/dashboard");
  }

  return redirect("/login");
}
