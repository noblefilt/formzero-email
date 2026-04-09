import { useState, useEffect } from "react"
import type { Form } from "#/types/form"
import type { User } from "#/types/user"
import { FormNav } from "#/components/form-nav"
import { LogOut, Settings } from "lucide-react"
import { useFetcher } from "react-router"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "#/components/ui/sidebar"
import { SettingsDialog } from "#/components/settings-dialog"
import type { Settings as SettingsType } from "#/types/settings"

type AppSidebarProps = {
  forms: Form[]
  user: User
} & React.ComponentProps<typeof Sidebar>

export function AppSidebar({ forms, user, ...props }: AppSidebarProps) {
  const fetcher = useFetcher()
  const settingsFetcher = useFetcher()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<SettingsType | null>(null)

  // Fetch settings when dialog opens
  useEffect(() => {
    if (settingsOpen && !settingsFetcher.data && settingsFetcher.state === "idle") {
      settingsFetcher.load("/settings/notifications")
    }
  }, [settingsOpen])

  // Update settings when fetcher returns data
  useEffect(() => {
    if (settingsFetcher.data?.settings) {
      setSettings(settingsFetcher.data.settings)
    }
  }, [settingsFetcher.data])

  const handleLogout = () => {
    fetcher.submit(null, { method: "post", action: "/logout" })
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <FormNav forms={forms} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="设置"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">设置</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.name}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="退出登录"
              onClick={handleLogout}
            >
              <LogOut />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">退出登录</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
      />
    </Sidebar>
  )
}
