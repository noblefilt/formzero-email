import { FileText, LayoutDashboard, ShieldAlert } from "lucide-react"
import { NavLink, useLocation, useParams } from "react-router"
import type { Form } from "#/types/form"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "#/components/ui/sidebar"

type FormNavProps = {
  forms: (Form & { submission_count?: number; unread_count?: number })[]
  spamCount?: number
}

export function FormNav({ forms, spamCount = 0 }: FormNavProps) {
  const params = useParams()
  const location = useLocation()
  const formId = params.formId

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center justify-between gap-2">
              <SidebarMenuButton
                asChild
                isActive={location.pathname === "/forms/dashboard"}
                className="min-w-0 flex-1"
              >
                <NavLink to="/forms/dashboard">
                  <LayoutDashboard />
                  <span>仪表盘</span>
                </NavLink>
              </SidebarMenuButton>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === "/forms/spam"}
                className="h-8 w-auto! shrink-0 px-2"
                title="垃圾邮件"
              >
                <NavLink to="/forms/spam" aria-label="垃圾邮件">
                  <ShieldAlert />
                  <span className="min-w-4 text-right tabular-nums">{spamCount}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>表单列表</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {forms.map((form) => (
              <SidebarMenuItem key={form.id}>
                <SidebarMenuButton asChild isActive={formId === form.id}>
                  <NavLink to={`/forms/${form.id}/submissions`}>
                    <FileText />
                    <span>{form.name}</span>
                  </NavLink>
                </SidebarMenuButton>
                {form.unread_count ? (
                  <SidebarMenuBadge className="bg-blue-500 text-white">{form.unread_count}</SidebarMenuBadge>
                ) : form.submission_count !== undefined ? (
                  <SidebarMenuBadge>{form.submission_count}</SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}
