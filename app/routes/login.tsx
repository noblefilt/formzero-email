import { Form, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/login";
import { getAuth, getUserCount } from "#/lib/auth.server";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { authClient } from "#/lib/auth.client";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "登录 | FormZero" },
    { name: "description", content: "登录您的 FormZero 账户" },
  ];
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const database = context.cloudflare.env.DB;
  const auth = getAuth({ database });

  // Redirect to app if already logged in
  const session = await auth.api.getSession({
      headers: request.headers
  });
  if (session?.user) {
    throw redirect("/forms/dashboard");
  }

  // Redirect to signup if no users exist
  const userCount = await getUserCount({ database });
  if (userCount === 0) {
      return redirect("/signup");
  }

  return {};
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/forms/dashboard"
    });

    if (signInError) {
      return { error: signInError.message || "邮箱或密码错误" };
    }

    // Success - redirect to forms
    return redirect("/forms/dashboard");
  } catch (err) {
    return { error: "登录失败，请重试" };
  }
}

export default function Login() {
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">欢迎回来</h1>
          <p className="mt-2 text-muted-foreground">
            登录以管理您的表单
          </p>
        </div>

        <Form method="post" className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {actionData?.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {actionData.error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "登录中..." : "登录"}
          </Button>
        </Form>
      </div>
    </div>
  );
}
