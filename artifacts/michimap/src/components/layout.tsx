import { ReactNode } from "react";
import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { LayoutDashboard } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  const { data: user } = useGetMe();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* HEADER */}
      <header className="sticky top-0 z-50 w-full bg-background border-b border-border">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-85 transition-opacity">
            <div className="bg-[#E9A944] text-white font-extrabold text-sm px-2.5 py-1.5 rounded-lg leading-none">
              3B
            </div>
            <div>
              <div className="font-bold text-base text-foreground leading-none">Michimap</div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium leading-tight">
                AI-POWERED FRAMEWORK TO PLAN YOUR EFFORTS. ZERO GUESSWORK.
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {user?.isAdmin && (
              <Link href="/admin" className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                <LayoutDashboard className="w-4 h-4" />
                Admin
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border bg-background py-6 mt-6">
        <div className="max-w-screen-xl mx-auto px-4 text-center space-y-1">
          <p className="text-sm text-muted-foreground">
            Dedicated to the SAP Pre-sales community by <strong className="text-foreground font-bold">Bharath Bhushan Bogi Setty</strong>.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Free and open source. SAP and SAP Activate are trademarks of SAP SE.
          </p>
        </div>
      </footer>
    </div>
  );
}
