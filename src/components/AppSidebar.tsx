import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, Package, TrendingUp, GitCompareArrows,
  Calculator, BarChart3, Upload, Settings, Sparkles, LogOut,
  Layers, FileSearch, Users,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Itens", url: "/itens", icon: Package },
  { title: "Itens em Mais de Um Contrato", url: "/multi-contrato", icon: Layers },
  { title: "Compras por Fornecedor", url: "/analise-fornecedores", icon: Users },
  { title: "Analisador de Contratos", url: "/analisador", icon: FileSearch },
  { title: "Reajustes", url: "/reajustes", icon: TrendingUp },
  { title: "Comparador", url: "/comparador", icon: GitCompareArrows },
  { title: "Calculadora", url: "/calculadora", icon: Calculator },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Importação", url: "/importacao", icon: Upload },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.77_0.14_82)] to-[oklch(0.65_0.13_60)] shadow-lg shadow-black/30">
            <Sparkles className="h-5 w-5 text-[oklch(0.15_0.03_265)]" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold tracking-tight text-sidebar-foreground">Contract Insight</span>
              <span className="text-[10px] uppercase tracking-widest text-[oklch(0.77_0.14_82)]/80">Procurement Intelligence</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70">Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = item.url === "/" ? path === "/" : path.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="group">
                        <item.icon className={`h-4 w-4 transition-colors ${active ? "text-[oklch(0.77_0.14_82)]" : "text-sidebar-foreground/60 group-hover:text-[oklch(0.77_0.14_82)]"}`} />
                        {!collapsed && <span className={active ? "font-semibold" : ""}>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Sair">
              <LogOut className="h-4 w-4 text-sidebar-foreground/60" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && (
          <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground/50">
            © {new Date().getFullYear()} Contract Insight
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}