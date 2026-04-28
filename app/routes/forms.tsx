import { Outlet, redirect, useLoaderData } from "react-router"
import type { Route } from "./+types/forms"
import type { Form } from "#/types/form"
import { AppSidebar } from "#/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "#/components/ui/sidebar"
import { requireAuth } from "~/lib/require-auth.server"

export async function loader({ context, request }: Route.LoaderArgs) {
  const database = context.cloudflare.env.DB

  const user = await requireAuth(request, database, context.cloudflare.env)

  // Fetch all forms with submission counts and unread counts
  const result = await database
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

  const forms = result.results as (Form & { submission_count: number; unread_count: number })[]
  const spamResult = await database
    .prepare("SELECT COUNT(*) AS count FROM submissions WHERE COALESCE(is_spam, 0) = 1")
    .first<{ count: number }>()
  const spamCount = spamResult?.count ?? 0

  // If no forms exist, redirect to create first form
  if (forms.length === 0) {
    return redirect("/setup")
  }

  // If we're at exactly /forms (with or without trailing slash), redirect to dashboard
  const url = new URL(request.url)
  const pathname = url.pathname.replace(/\/$/, "") // Remove trailing slash
  if (pathname === "/forms") {
    return redirect("/forms/dashboard")
  }

  return { forms, user, spamCount }
}

export async function action({ request, context }: Route.ActionArgs) {
  const database = context.cloudflare.env.DB

  await requireAuth(request, database, context.cloudflare.env)

  const formData = await request.formData()
  const intent = formData.get("intent") as string

  if (intent === "rename") {
    const formId = formData.get("formId") as string
    const newName = formData.get("name") as string
    if (!formId || !newName) {
      return { error: "表单 ID 和新名称为必填项" }
    }
    await database
      .prepare("UPDATE forms SET name = ?, updated_at = ? WHERE id = ?")
      .bind(newName, Date.now(), formId)
      .run()
    return { success: true }
  }

  if (intent === "delete") {
    const formId = formData.get("formId") as string
    if (!formId) {
      return { error: "表单 ID 为必填项" }
    }
    // Delete all submissions for this form first
    await database
      .prepare("DELETE FROM submissions WHERE form_id = ?")
      .bind(formId)
      .run()
    // Delete the form
    await database
      .prepare("DELETE FROM forms WHERE id = ?")
      .bind(formId)
      .run()
    // Check if there are remaining forms
    const remaining = await database
      .prepare("SELECT id FROM forms ORDER BY created_at ASC LIMIT 1")
      .first()
    if (remaining) {
      return redirect("/forms/dashboard")
    }
    return redirect("/setup")
  }

  // Default: create new form
  const name = formData.get("name") as string

  if (!name) {
    return { error: "表单名称为必填项" }
  }

  // Generate a slug from the form name
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  // Check if form with this ID already exists
  const existing = await database
    .prepare("SELECT id FROM forms WHERE id = ?")
    .bind(id)
    .first()

  if (existing) {
    return { error: "已存在同名表单" }
  }

  const createdAt = Date.now()

  await database
    .prepare(
      "INSERT INTO forms (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
    )
    .bind(id, name, createdAt, createdAt)
    .run()

  return redirect(`/forms/${id}/submissions`)
}

export default function Forms() {
  const { forms, user, spamCount } = useLoaderData<typeof loader>()

  return (
    <SidebarProvider>
      <AppSidebar forms={forms} user={user} spamCount={spamCount} />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
