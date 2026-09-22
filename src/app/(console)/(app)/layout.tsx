import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { TopBar } from "@/components/shell/TopBar";
import { OfflineBanner } from "@/components/shell/OfflineBanner";
import { ShellMain } from "@/components/shell/ShellMain";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <OfflineBanner />
        <TopBar />
        <ShellMain>{children}</ShellMain>
      </SidebarInset>
    </SidebarProvider>
  );
}
