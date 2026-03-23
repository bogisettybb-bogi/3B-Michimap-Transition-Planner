import { ReactNode, useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { LayoutDashboard, Copy, Check, X } from "lucide-react";

const APP_URL = "https://threeb-michimap-transition-planner.onrender.com";

const DRAFT_TEXT = `Most SAP transformation proposals take days to build.
3B Michimap does it in minutes.
AI-powered. Beautiful interface. Professional Excel output you will be surprised.

Built specifically for SAP Pre-Sales.

👉 ${APP_URL}

#SAP #S4HANA #PreSales #SAPConsulting #3BMichimap`;

const LI_URL = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(APP_URL)}&title=${encodeURIComponent("3B Michimap - AI-Powered SAP S/4HANA Project Planner")}&summary=${encodeURIComponent(DRAFT_TEXT)}`;

export const TERMS_CLAUSES = [
  {
    title: "Disclaimer of Warranty",
    text: `The project plans, effort estimates, activity listings, and associated deliverables made available through 3B Michimap are generated wholly or partly by artificial intelligence language models. All such outputs are provided strictly on an "as is" and "as available" basis, without any warranty of any nature, whether express, implied, statutory, or otherwise, including but not limited to any warranty as to accuracy, completeness, fitness for a particular purpose, or non-infringement. The operator makes no representation that any AI-generated content accurately reflects the actual effort, timelines, or resource requirements of any specific SAP S/4HANA engagement.`,
  },
  {
    title: "No Commercial Reliance",
    text: "Outputs produced by this tool are intended solely for internal pre-sales planning and estimation purposes. They shall not be submitted to clients, incorporated into binding commercial proposals, Statements of Work, or contracts without prior independent review and validation by a qualified SAP professional. The operator disclaims all liability, whether in contract, tort, or otherwise, for any loss, damage, or claim arising from reliance on AI-generated outputs in any commercial or contractual context.",
  },
  {
    title: "Acceptable Use Policy",
    text: `By accessing and using 3B Michimap, you represent and warrant that: (a) you are an SAP pre-sales or delivery professional using this tool solely for internal planning purposes within your organisation; (b) you will not use this tool to generate outputs intended to deceive, mislead, or defraud any third party; (c) you will not reverse-engineer, scrape, reproduce, redistribute, resell, or sublicense any part of this tool, its underlying technology, or its generated outputs for commercial gain; (d) you will not use this tool in any manner that violates applicable law, regulation, or the rights of any third party; (e) you acknowledge that AI systems may produce plausible but factually incorrect outputs ("hallucinations") and you accept full responsibility for verifying the accuracy of all outputs before use.`,
  },
  {
    title: "Acknowledgement of AI Limitations",
    text: "The AI language models used within this tool have inherent limitations and may produce outputs that are inaccurate, outdated, inconsistent, or contextually inappropriate. In particular, AI-generated SAP Activate activities, effort estimates, and resource allocations may not reflect current SAP methodology guidance, applicable compliance requirements, or client-specific constraints. Users must apply professional judgement and independent validation to all outputs. This tool does not replace the expertise of a qualified SAP consultant, and no consulting relationship is created by its use.",
  },
  {
    title: "Data Collection and Privacy",
    text: "Certain usage metadata, including transition path selected, AI model used, total estimated weeks, device type, and approximate location derived from IP address, is collected solely for product improvement and usage analytics. This is undertaken in accordance with the Digital Personal Data Protection Act, 2023. No personally identifiable information is required to use the core planning functionality of this tool. By using this tool, you consent to the collection and processing of this anonymised usage data.",
  },
  {
    title: "Intellectual Property",
    text: "SAP, SAP Activate, SAP Cloud ALM, and S/4HANA are trademarks or registered trademarks of SAP SE in Germany and other countries. 3B Michimap is an independent community resource and is not affiliated with, endorsed by, or sponsored by SAP SE. All intellectual property rights in the tool's original design and code vest in the operator and are protected under the Copyright Act, 1957.",
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const { data: user } = useGetMe();
  const [open, setOpen]                   = useState(false);
  const [copied, setCopied]               = useState(false);
  const [activeClause, setActiveClause]   = useState<number | null>(null);
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
      <footer className="border-t border-border bg-background py-6 mt-6">
        <div className="max-w-screen-xl mx-auto px-4 text-center space-y-3">
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
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span className="text-xs text-muted-foreground/60 font-medium">Terms &amp; Disclaimers:</span>
            {TERMS_CLAUSES.map((c, i) => (
              <button
                key={i}
                onClick={() => setActiveClause(i)}
                className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
              >
                {c.title}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/50">Governed by the Laws of India · AI-generated outputs are for pre-sales use only.</p>
        </div>
      </footer>

      {/* CLAUSE DETAIL MODAL */}
      {activeClause !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveClause(null)}
        >
          <div
            className="bg-background rounded-2xl shadow-2xl max-w-lg w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-foreground">{TERMS_CLAUSES[activeClause].title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Governed by the Laws of India · 3B Michimap</p>
              </div>
              <button onClick={() => setActiveClause(null)} className="text-muted-foreground hover:text-foreground transition-colors ml-4 mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-muted-foreground leading-relaxed">{TERMS_CLAUSES[activeClause].text}</p>
            </div>
            <div className="px-6 pb-5 flex gap-2 justify-end">
              {activeClause > 0 && (
                <button onClick={() => setActiveClause(i => i! - 1)} className="px-4 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors">
                  Previous
                </button>
              )}
              {activeClause < TERMS_CLAUSES.length - 1 && (
                <button onClick={() => setActiveClause(i => i! + 1)} className="px-4 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors">
                  Next
                </button>
              )}
              <button onClick={() => setActiveClause(null)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
