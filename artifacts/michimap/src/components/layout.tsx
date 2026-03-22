import { ReactNode } from "react";
import { Link } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { LogOut, LayoutDashboard, Loader2 } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useGetMe();
  const { mutate: logout } = useLogout();

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <div className="bg-primary text-primary-foreground font-display font-bold text-xl px-2 py-1 rounded-md shadow-sm">
              3B
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg leading-none tracking-tight">Michimap</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">SAP S/4HANA Pre-sales Tool</span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : user ? (
              <div className="flex items-center gap-4">
                {user.isAdmin && (
                  <Link href="/admin" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5">
                    <LayoutDashboard className="w-4 h-4" />
                    Admin
                  </Link>
                )}
                <div className="flex items-center gap-2 border-l border-border pl-4">
                  {user.avatarUrl && (
                    <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full border border-border" />
                  )}
                  <span className="text-sm font-medium hidden sm:block">{user.name}</span>
                  <button 
                    onClick={() => logout({})}
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground font-medium">
                Guest Mode
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-card mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <p className="text-sm text-muted-foreground font-medium">
            Dedicated to the SAP Pre-sales community by Bharath Bhushan Bogi Setty.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Free and open source. SAP and SAP Activate are trademarks of SAP SE.
          </p>
        </div>
      </footer>
    </div>
  );
}
