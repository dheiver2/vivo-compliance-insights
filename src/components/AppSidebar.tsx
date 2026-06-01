import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Phone,
  Settings,
  Headphones,
  Users,
  GraduationCap,
  ClipboardCheck,
  FileSpreadsheet,
  AudioLines,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { VivoLogo } from "@/components/VivoLogo";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Ligações", url: "/calls", icon: Phone },
  { title: "Áudios", url: "/audios", icon: AudioLines },
  { title: "Equipe", url: "/team", icon: Users },
  { title: "Coaching", url: "/coaching", icon: GraduationCap },
  { title: "Scorecards", url: "/scorecards", icon: ClipboardCheck },
  { title: "Relatórios", url: "/relatorios", icon: FileSpreadsheet },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Headphones className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col gap-1">
              <span className="font-display font-bold text-sidebar-foreground leading-none">
                VoiceAudit
              </span>
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                por <VivoLogo className="h-2.5 text-sidebar-foreground/80" /> · Compliance
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/settings"}>
                  <Link to="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    {!collapsed && <span>Configurações</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
