import { useState, useEffect } from "react";

const STORAGE_KEY = "michimap_terms_accepted_v1";

const CLAUSES = [
  {
    title: "1. Disclaimer of Warranty — AI-Generated Outputs",
    text: `The project plans, effort estimates, activity listings, and associated deliverables made available through 3B Michimap are generated wholly or partly by artificial intelligence language models. All such outputs are provided strictly on an "as is" and "as available" basis, without any warranty of any nature, whether express, implied, statutory, or otherwise, including but not limited to any warranty as to accuracy, completeness, fitness for a particular purpose, or non-infringement. The operator makes no representation that any AI-generated content accurately reflects the actual effort, timelines, or resource requirements of any specific SAP S/4HANA engagement.`,
  },
  {
    title: "2. No Commercial Reliance",
    text: "Outputs produced by this tool are intended solely for internal pre-sales planning and estimation purposes. They shall not be submitted to clients, incorporated into binding commercial proposals, Statements of Work, or contracts without prior independent review and validation by a qualified SAP professional. The operator disclaims all liability, whether in contract, tort, or otherwise, for any loss, damage, or claim arising from reliance on AI-generated outputs in any commercial or contractual context.",
  },
  {
    title: "3. Acceptable Use Policy",
    text: `By accessing and using 3B Michimap, you represent and warrant that: (a) you are an SAP pre-sales or delivery professional using this tool solely for internal planning purposes within your organisation; (b) you will not use this tool to generate outputs intended to deceive, mislead, or defraud any third party, and you acknowledge that any such use may attract liability under applicable Indian law; (c) you will not reverse-engineer, scrape, reproduce, redistribute, resell, or sublicense any part of this tool, its underlying technology, or its generated outputs for commercial gain, and you acknowledge that such acts may constitute infringement under the Copyright Act, 1957; (d) you will not use this tool in any manner that violates applicable law, regulation, or the rights of any third party, including obligations under the Digital Personal Data Protection Act, 2023; (e) you acknowledge that AI systems may produce plausible but factually incorrect outputs, commonly referred to as "hallucinations," and you accept full responsibility for verifying the accuracy of all outputs before use. The operator reserves the right to suspend or terminate access for any user found to be in breach of these terms.`,
  },
  {
    title: "4. Acknowledgement of AI Limitations",
    text: "The AI language models used within this tool have inherent limitations and may produce outputs that are inaccurate, outdated, inconsistent, or contextually inappropriate. In particular, AI-generated SAP Activate activities, effort estimates, and resource allocations may not reflect current SAP methodology guidance, applicable compliance requirements, or client-specific constraints. Users must apply professional judgement and independent validation to all outputs. This tool does not replace the expertise of a qualified SAP consultant, and no consulting relationship is created by its use.",
  },
  {
    title: "5. Data Collection and Privacy",
    text: "Certain usage metadata, including transition path selected, AI model used, total estimated weeks, device type, and approximate location derived from IP address, is collected solely for product improvement and usage analytics. This is undertaken in accordance with the Digital Personal Data Protection Act, 2023. No personally identifiable information is required to use the core planning functionality of this tool. By using this tool, you consent to the collection and processing of this anonymised usage data. You may withdraw consent in accordance with applicable law, though doing so may affect your access to the tool.",
  },
  {
    title: "6. Intellectual Property",
    text: "SAP, SAP Activate, SAP Cloud ALM, and S/4HANA are trademarks or registered trademarks of SAP SE in Germany and other countries, and are protected under applicable trademark laws in India. The operator claims no right or interest in any SAP trademark or methodology. 3B Michimap is an independent community resource and is not affiliated with, endorsed by, or sponsored by SAP SE. Any reference to SAP frameworks in generated outputs is for illustrative purposes only. All intellectual property rights in the tool's original design and code vest in the operator and are protected under the Copyright Act, 1957.",
  },
];

interface Props {
  children: React.ReactNode;
}

export function TermsGate({ children }: Props) {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [checked, setChecked]   = useState(false);

  useEffect(() => {
    setAccepted(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setAccepted(true);
  };

  if (accepted === null) return null;

  if (accepted) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-background px-6 py-4 flex items-center gap-3">
        <div className="bg-[#E9A944] text-white font-extrabold text-sm px-2.5 py-1.5 rounded-lg leading-none">
          3B
        </div>
        <div>
          <div className="font-bold text-base text-foreground leading-none">Michimap</div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium leading-tight">
            AI-POWERED FRAMEWORK TO PLAN YOUR EFFORTS. ZERO GUESSWORK.
          </div>
        </div>
      </div>

      {/* Scrollable terms body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-3xl mx-auto w-full">
        <h1 className="text-xl font-bold text-foreground mb-0.5">Disclaimer &amp; Terms of Use</h1>
        <p className="text-xs text-muted-foreground mb-6">Governed by the Laws of India · 3B Michimap</p>

        <div className="space-y-6">
          {CLAUSES.map((c, i) => (
            <div key={i} className="border-l-2 border-primary/30 pl-4">
              <h3 className="font-bold text-sm text-foreground mb-1">{c.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky footer with checkbox + accept */}
      <div className="shrink-0 border-t border-border bg-background px-6 py-5">
        <div className="max-w-3xl mx-auto space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#E9A944] shrink-0 cursor-pointer"
            />
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
              I have read and agree to the Disclaimer &amp; Terms of Use above. I understand that outputs are AI-generated, for internal pre-sales use only, and require independent professional validation before any commercial use.
            </span>
          </label>
          <button
            onClick={handleAccept}
            disabled={!checked}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
              checked
                ? "bg-[#E9A944] text-white hover:opacity-90 shadow"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            Accept &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
}
