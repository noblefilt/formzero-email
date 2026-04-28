import type { Route } from "./+types/editor"
import { loadEditorBootstrap, mutateEditorStorage } from "#/lib/email-editor.server"
import type { Form } from "#/types/form"
import { AppSidebar } from "#/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "#/components/ui/sidebar"
import { requireAuth } from "~/lib/require-auth.server"
import { EditorShell } from "../../src/editor/editor-shell"

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Editor | FormZero" },
    {
      name: "description",
      content: "Professional email template editor workspace.",
    },
  ]
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const database = context.cloudflare.env.DB
  const user = await requireAuth(request, database)
  const bootstrap = await loadEditorBootstrap(database, user.id)
  const formsResult = await database
    .prepare(
      `SELECT f.id, f.name,
              SUM(CASE WHEN s.id IS NOT NULL AND COALESCE(s.is_spam, 0) = 0 THEN 1 ELSE 0 END) as submission_count,
              SUM(CASE WHEN s.id IS NOT NULL AND COALESCE(s.is_spam, 0) = 0 AND s.is_read = 0 AND s.is_archived = 0 THEN 1 ELSE 0 END) as unread_count
       FROM forms f
       LEFT JOIN submissions s ON f.id = s.form_id
       GROUP BY f.id, f.name
       ORDER BY f.created_at ASC`
    )
    .all()

  const forms = formsResult.results as (Form & {
    submission_count: number
    unread_count: number
  })[]
  const spamResult = await database
    .prepare("SELECT COUNT(*) AS count FROM submissions WHERE COALESCE(is_spam, 0) = 1")
    .first<{ count: number }>()

  return { user, bootstrap, forms, spamCount: spamResult?.count ?? 0 }
}

export async function action({ request, context }: Route.ActionArgs) {
  const database = context.cloudflare.env.DB
  const user = await requireAuth(request, database)

  try {
    const payload = (await request.json()) as Parameters<typeof mutateEditorStorage>[2]
    const bootstrap = await mutateEditorStorage(database, user.id, payload)

    return Response.json({
      ok: true,
      bootstrap,
    })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Editor persistence failed.",
      },
      { status: 400 }
    )
  }
}

export default function EditorRoute({ loaderData }: Route.ComponentProps) {
  return (
    <SidebarProvider>
      <AppSidebar
        forms={loaderData.forms}
        user={loaderData.user}
        spamCount={loaderData.spamCount}
      />
      <SidebarInset>
        <EditorShell
          userName={loaderData.user.name}
          initialBootstrap={loaderData.bootstrap}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
