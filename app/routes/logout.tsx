import { redirect } from "react-router";
import type { Route } from "./+types/logout";

export async function clientAction({ request }: Route.ClientActionArgs) {
  void request
  const { authClient } = await import("#/lib/auth.client");
  await authClient.signOut();
  return redirect("/login");
}
