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
  spamCount?: number
} & React.ComponentProps<typeof Sidebar>

export function AppSidebar({ forms, user, spamCount = 0, ...props }: AppSidebarProps) {
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

  void user

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <FormNav forms={forms} spamCount={spamCount} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu className="grid grid-cols-2 gap-2 group-data-[collapsible=icon]:grid-cols-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="default"
              tooltip="设置"
              onClick={() => setSettingsOpen(true)}
              className="justify-center"
            >
              <Settings />
              <span className="font-medium">设置</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="default"
              tooltip="退出登录"
              onClick={handleLogout}
              className="justify-center"
            >
              <LogOut />
              <span className="font-medium">退出登录</span>
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
