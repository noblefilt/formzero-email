import { data, Link } from "react-router"

import { Button } from "#/components/ui/button"

export function loader() {
  return data(null, { status: 404 })
}

export const meta = () => [
  { title: "Page not found | FormZero" },
  {
    name: "description",
    content: "The requested FormZero page does not exist.",
  },
]

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This URL is not part of the FormZero workspace. Return to the
          dashboard or check that the address is spelled correctly.
        </p>
        <Button asChild className="mt-6">
          <Link to="/forms/dashboard">Go to dashboard</Link>
        </Button>
      </section>
    </main>
  )
}
