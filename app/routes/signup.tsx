import { Form, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/signup";
import { getAuth, getUserCount } from "#/lib/auth.server";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { authClient } from "#/lib/auth.client";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "注册 | FormZero" },
    { name: "description", content: "创建您的 FormZero 账户" },
  ];
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const database = context.cloudflare.env.DB;
  const auth = getAuth({
      database,
      baseURL: new URL(request.url).origin,
  });

  // Redirect to app if already logged in
  const session = await auth.api.getSession({
      headers: request.headers
  });
  if (session?.user) {
    return redirect("/forms/dashboard");
  }

  // Redirect to login if users already exist
  const userCount = await getUserCount({ database });
  if (userCount > 0) {
    return redirect("/login");
  }

  return {};
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const name = formData.get("name") as string;

  // Validate passwords match
  if (password !== confirmPassword) {
    return { error: "两次密码输入不一致" };
  }

  try {
    const { error: signUpError } = await authClient.signUp.email({
      email,
      password,
      name,
      callbackURL: "/forms/dashboard"
    });

    if (signUpError) {
      return { error: signUpError.message || "创建账户失败" };
    }

    // Success - redirect to forms
    return redirect("/forms/dashboard");
  } catch (err) {
    return { error: "创建账户失败，请重试" };
  }
}

export default function Signup() {
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">欢迎使用 FormZero</h1>
          <p className="mt-2 text-muted-foreground">
            创建账户开始使用
          </p>
        </div>

        <Form method="post" className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                placeholder="请输入姓名"
                autoComplete="name"
                disabled={isSubmitting}
              />
            </div>

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
                placeholder="至少 8 个字符"
                minLength={8}
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                placeholder="再次输入密码"
                minLength={8}
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <strong>重要提示：</strong>请牢记您的密码，目前暂不支持密码找回。
          </div>

          {actionData?.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {actionData.error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "创建中..." : "创建账户"}
          </Button>
        </Form>
      </div>
    </div>
  );
}
