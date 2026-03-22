import { ReactNode, useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { LayoutDashboard, Copy, Check } from "lucide-react";
import { TermsGate } from "@/components/terms-gate";

const APP_URL = "https://3bmichimap.replit.app";
const LI_URL  = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(APP_URL)}`;


const DRAFT_TEXT = `S/4HANA Transition Planning. Simplified.

AI powered 3B MichiMap gives your team a credible starting point in minutes.
Effort estimation. Transition scoping. Presales-ready output, all from one intelligent tool built on S/4HANA logic.
No spreadsheets. No guesswork.

This is what accelerated presales looks like. : ${APP_URL}

#S4HANA #SAP #Presales #Transformation #SAPCommunity`;

export function Layout({ children }: { children: ReactNode }) {
  const { data: user } = useGetMe();
  const [open, setOpen]                   = useState(false);
  const [copied, setCopied]               = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleCopy = () => {
    navigator.clipboard.writeText(DRAFT_TEXT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <TermsGate>
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
            <div className="relative" ref={popoverRef}>
              <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A66C2] text-white text-xs font-bold hover:bg-[#0958a8] transition-colors cursor-pointer"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                <span className="hidden sm:inline">Share</span>
              </button>

              {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-xl shadow-lg p-4 space-y-3 z-50">
                  <p className="text-[11px] font-semibold text-foreground">Copy this draft, then paste it into LinkedIn:</p>
                  <pre className="text-[10px] text-muted-foreground bg-muted rounded-lg p-3 whitespace-pre-wrap leading-relaxed font-sans select-all">
                    {DRAFT_TEXT}
                  </pre>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleCopy}
                      className={`flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-bold transition-colors ${
                        copied ? "bg-green-600 text-white" : "bg-muted text-foreground hover:bg-muted/70"
                      }`}
                    >
                      {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Post Text</>}
                    </button>
                    <button
                      onClick={() => { window.open(LI_URL, "_blank", "noopener,noreferrer"); setOpen(false); }}
                      className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-[#0A66C2] text-white text-xs font-bold hover:bg-[#0958a8] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                      Post on LinkedIn
                    </button>
                  </div>
                </div>
              )}
            </div>

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
      <footer className="border-t border-border bg-background py-5 mt-6">
        <div className="max-w-screen-xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Dedicated to the SAP Pre-sales community by{" "}
            <a
              href="https://www.linkedin.com/in/bharathbhushanb/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-foreground hover:text-primary transition-colors underline underline-offset-2"
            >
              3B
            </a>.
          </p>
        </div>
      </footer>
    </div>
    </TermsGate>
  );
}
