import { redirect, useFetcher } from "react-router"
import type { Route } from "./+types/setup"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import { Label } from "#/components/ui/label"
import { getAuth } from "~/lib/auth.server"

export const meta: Route.MetaFunction = () => {
  return [
    { title: "创建您的第一个表单 | FormZero" },
    { name: "description", content: "创建表单开始收集提交数据" },
  ];
};

export async function loader({ context, request }: Route.LoaderArgs) {
  const database = context.cloudflare.env.DB

  // Redirect to login if not authenticated
  const auth = getAuth({
    database,
    baseURL: new URL(request.url).origin,
  })
  const session = await auth.api.getSession({
    headers: request.headers
  })
  if (!session?.user) {
    return redirect("/login")
  }

  // Check if forms exist - if they do, redirect to /forms
  const result = await database
    .prepare("SELECT id FROM forms LIMIT 1")
    .first()

  if (result) {
    return redirect("/forms")
  }

  return {}
}

export default function Setup() {
  const fetcher = useFetcher<{ error?: string }>()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">
              创建您的第一个表单
            </h1>
            <p className="mt-2 text-muted-foreground">
              几秒钟即可开始收集表单数据
            </p>
          </div>
        </div>

        <fetcher.Form method="post" action="/forms" className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                表单名称
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="联系表单"
                required
                autoFocus
              />
              {fetcher.data && "error" in fetcher.data && (
                <p className="text-sm text-destructive">
                  {fetcher.data.error as string}
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={fetcher.state === "submitting"}
            className="w-full"
          >
            {fetcher.state === "submitting" ? "创建中..." : "创建表单"}
          </Button>
        </fetcher.Form>
      </div>
    </div>
  )
}
