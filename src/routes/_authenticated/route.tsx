import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: Layout,
});

function Layout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
            <SidebarTrigger className="text-foreground hover:text-[oklch(0.77_0.14_82)]" />
            <div className="h-6 w-px bg-border/60" />
            <div className="text-sm text-muted-foreground">
              <span className="text-[oklch(0.77_0.14_82)] font-semibold">Contract Insight</span> · Portal Inteligente de Gestão de Contratos
            </div>
          </header>
          <main className="flex-1 p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
        <Toaster theme="dark" position="top-right" />
      </div>
    </SidebarProvider>
  );
}