import { Database, Puzzle, LayoutDashboard, FileText, Mail } from "lucide-react"
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
}

export function FormNav({ forms }: FormNavProps) {
  const params = useParams()
  const location = useLocation()
  const formId = params.formId

  const formItems = formId ? [
    {
      title: "提交数据",
      url: `/forms/${formId}/submissions`,
      icon: Database,
    },
    {
      title: "集成",
      url: `/forms/${formId}/integration`,
      icon: Puzzle,
    },
  ] : []

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location.pathname === "/forms/dashboard"}>
                <NavLink to="/forms/dashboard">
                  <LayoutDashboard />
                  <span>仪表盘</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location.pathname.startsWith("/editor")}>
                <NavLink to="/editor">
                  <Mail />
                  <span>邮件编辑器</span>
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
      {formItems.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>当前表单</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {formItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  )
}
