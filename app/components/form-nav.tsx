import { LayoutDashboard, FileText } from "lucide-react"
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
