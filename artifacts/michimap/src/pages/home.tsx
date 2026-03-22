import { useState } from "react";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Sparkles, Loader2, Minus, Plus, X } from "lucide-react";
import { Layout } from "@/components/layout";
import { PlanPreview } from "@/components/plan-preview";
import { MODELS, TRANSITION_PATHS, PHASES_META, cn } from "@/lib/utils";
import {
  useGetMe,
  useGeneratePlan,
  useDownloadPlan,
  GeneratePlanRequestTransitionPath,
  GeneratePlanResponse,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

// Disclaimers modal
function DisclaimersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors">
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
        <h2 className="text-2xl font-bold text-foreground mb-6">Disclaimers &amp; Terms of Use</h2>
        <div className="space-y-6">
          {[
            {
              title: "1. Accuracy / No Warranty",
              text: "Effort estimates are indicative and based on inputs provided by the user. 3B Michimap makes no warranty, express or implied, regarding the accuracy, completeness, or fitness of generated outputs for any specific engagement."
            },
            {
              title: "2. No Commercial Reliance",
              text: "Outputs from this tool are intended for internal planning purposes only and should not be submitted to clients or included in formal commercial proposals without independent validation by a qualified SAP professional."
            },
            {
              title: "3. Third-Party Login",
              text: "Authentication is facilitated via third-party providers (Google, LinkedIn). 3B Michimap is not responsible for data handling practices of these providers. Users are encouraged to review their respective privacy policies."
            },
            {
              title: "4. Acceptable Use",
              text: "This tool is intended exclusively for SAP pre-sales and delivery professionals. Unauthorised use, reverse engineering, or redistribution of generated outputs is prohibited."
            }
          ].map(d => (
            <div key={d.title} className="border-l-2 border-primary/40 pl-4">
              <h3 className="font-bold text-foreground mb-1">{d.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{d.text}</p>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-8 w-full bg-secondary text-secondary-foreground font-semibold rounded-xl py-3 hover:opacity-90 transition-opacity">
          Close
        </button>
      </div>
    </div>
  );
}

const TRANSITION_PATH_COLORS = {
  greenfield: {
    selected: "border-[#2E7D32] bg-[#E8F5E9]",
    badge: "bg-[#C8E6C9] text-[#1B5E20]",
    dot: "bg-[#4CAF50]",
    title: "text-[#2E7D32]",
    subtitle: "text-[#388E3C]",
    desc: "bg-[#F1F8E9] border-[#C5E1A5]",
    descText: "text-[#33691E]",
    descLabel: "text-[#558B2F]",
  },
  brownfield: {
    selected: "border-[#8D4E2B] bg-[#FBE9E7]",
    badge: "bg-[#FFCCBC] text-[#5D2E14]",
    dot: "bg-[#A0522D]",
    title: "text-[#6D3B20]",
    subtitle: "text-[#8D4E2B]",
    desc: "bg-[#FFF8F5] border-[#FFCCBC]",
    descText: "text-[#5D2E14]",
    descLabel: "text-[#8D4E2B]",
  },
  bluefield: {
    selected: "border-[#1565C0] bg-[#E3F2FD]",
    badge: "bg-[#BBDEFB] text-[#0D3C7A]",
    dot: "bg-[#1976D2]",
    title: "text-[#1565C0]",
    subtitle: "text-[#1976D2]",
    desc: "bg-[#EFF8FF] border-[#BBDEFB]",
    descText: "text-[#0D3C7A]",
    descLabel: "text-[#1565C0]",
  },
};

export default function Home() {
  const { data: user } = useGetMe();
  const { mutateAsync: generatePlan, isPending: isGenerating } = useGeneratePlan();
  const { mutateAsync: downloadPlan, isPending: isDownloading } = useDownloadPlan();
  const { toast } = useToast();

  const [aiModel, setAiModel] = useState("gpt-5.2");
  const [apiKey, setApiKey] = useState("");
  const [transitionPath, setTransitionPath] = useState<GeneratePlanRequestTransitionPath>("brownfield");
  const [projectStartDate, setProjectStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [phases, setPhases] = useState({
    discover: { weeks: 2, included: false },
    prepare: { weeks: 4 },
    explore: { weeks: 6 },
    realizeDevelop: { weeks: 12 },
    deploy: { weeks: 2 },
    run: { weeks: 4 },
  });
  const [generatedResult, setGeneratedResult] = useState<GeneratePlanResponse | null>(null);
  const [isDisclaimersOpen, setIsDisclaimersOpen] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const isPaidModel = MODELS.paid.some(m => m.id === aiModel);

  const totalWeeks =
    (phases.discover.included ? phases.discover.weeks : 0) +
    phases.prepare.weeks +
    phases.explore.weeks +
    phases.realizeDevelop.weeks +
    phases.deploy.weeks +
    phases.run.weeks;

  const totalMonths = (totalWeeks / 4.33).toFixed(1);

  const handleGenerate = async () => {
    if (isPaidModel && !apiKey.trim()) {
      toast({ title: "API Key Required", description: "Please enter your API key for the selected paid model.", variant: "destructive" });
      return;
    }
    try {
      const res = await generatePlan({
        data: {
          aiModel,
          apiKey: isPaidModel ? apiKey : null,
          transitionPath,
          projectStartDate,
          phases: {
            discover: phases.discover,
            prepare: { weeks: phases.prepare.weeks },
            explore: { weeks: phases.explore.weeks },
            realizeDevelop: { weeks: phases.realizeDevelop.weeks },
            deploy: { weeks: phases.deploy.weeks },
            run: { weeks: phases.run.weeks },
          },
        },
      });
      setGeneratedResult(res);
      setTimeout(() => {
        document.getElementById("plan-preview")?.scrollIntoView({ behavior: "smooth" });
      }, 200);
    } catch (err: any) {
      toast({ title: "Generation Failed", description: err.message || "Failed to generate project plan.", variant: "destructive" });
    }
  };

  const handleDownload = async () => {
    if (!generatedResult) return;
    if (!agreedToTerms) {
      toast({ title: "Agreement Required", description: "Please agree to the Disclaimers & Terms of Use.", variant: "destructive" });
      return;
    }
    try {
      const blob = await downloadPlan({ data: { planId: generatedResult.planId } });
      const url = URL.createObjectURL(blob as any);
      const a = document.createElement("a");
      a.href = url;
      a.download = `3B_Michimap_${transitionPath}_${projectStartDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download Started", description: "Your SAP Activate plan is downloading." });
    } catch (err: any) {
      toast({ title: "Download Failed", description: "Please try again or regenerate the plan.", variant: "destructive" });
    }
  };

  const updatePhaseWeeks = (key: keyof typeof phases, delta: number) => {
    setPhases(prev => ({
      ...prev,
      [key]: { ...prev[key], weeks: Math.max(1, prev[key].weeks + delta) },
    }));
  };

  const colors = TRANSITION_PATH_COLORS[transitionPath];

  return (
    <Layout>
      <DisclaimersModal open={isDisclaimersOpen} onClose={() => setIsDisclaimersOpen(false)} />

      <div className="max-w-2xl mx-auto px-4 py-10 pb-20">

        {/* HERO */}
        <div className="mb-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-card text-primary text-sm font-medium shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered SAP Activate Planner
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground uppercase tracking-tight leading-[1.05]">
            Every Implementation<br />Has A Road.
          </h1>

          <p className="text-base text-muted-foreground leading-relaxed">
            <span className="text-primary font-semibold">3B Michimap</span> generates the structured estimation template to accelerate your SAP S/4HANA transformation needs.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {["Greenfield", "Brownfield", "Bluefield", "SAP Activate", "S/4HANA", "Pre-sales"].map(tag => (
              <span key={tag} className="px-3 py-1 text-xs font-medium text-foreground/60 bg-card border border-border rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* MAIN FORM CARD */}
        <div className="bg-card rounded-2xl border border-border shadow-md overflow-hidden">
          <div className="p-6 space-y-8">

            {/* AI MODEL */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-primary uppercase tracking-wider">AI Model</label>
              <div className="relative">
                <select
                  value={aiModel}
                  onChange={e => setAiModel(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all appearance-none pr-10 cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23666'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundPosition: "right 0.75rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.2em" }}
                >
                  <optgroup label="Free (via Replit — No Key Needed)">
                    {MODELS.free.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </optgroup>
                  <optgroup label="Paid (Enter Your API Key Below)">
                    {MODELS.paid.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </optgroup>
                </select>
              </div>
              <AnimatePresence>
                {isPaidModel && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <input
                      type="password"
                      placeholder="Enter your API key..."
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      className="w-full mt-2 bg-background border border-primary/40 rounded-xl px-4 py-3 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* TRANSITION PATH */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-primary uppercase tracking-wider">Transition Path</label>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(TRANSITION_PATHS) as GeneratePlanRequestTransitionPath[]).map(pathId => {
                  const path = TRANSITION_PATHS[pathId];
                  const c = TRANSITION_PATH_COLORS[pathId];
                  const isSelected = transitionPath === pathId;
                  return (
                    <button
                      key={pathId}
                      onClick={() => setTransitionPath(pathId)}
                      className={cn(
                        "text-left p-4 rounded-xl border-2 transition-all duration-200",
                        isSelected ? c.selected : "border-border bg-background hover:border-border/80 hover:bg-muted/30"
                      )}
                    >
                      <div className={cn("font-bold text-sm mb-1", isSelected ? c.title : "text-foreground")}>
                        {path.name}
                      </div>
                      <div className={cn("text-[11px] leading-tight", isSelected ? c.subtitle : "text-muted-foreground")}>
                        {path.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={transitionPath}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn("rounded-xl border p-4", colors.desc)}
                >
                  <p className={cn("text-sm leading-relaxed", colors.descText)}>
                    <span className={cn("font-bold mr-1", colors.descLabel)}>
                      {TRANSITION_PATHS[transitionPath].name}:
                    </span>
                    {TRANSITION_PATHS[transitionPath].description}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* PROJECT START DATE */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-primary uppercase tracking-wider">Project Start Date</label>
              <input
                type="date"
                value={projectStartDate}
                onChange={e => setProjectStartDate(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>

            {/* PHASE DURATIONS */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-primary uppercase tracking-wider">Phase Durations (Weeks)</label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(phases) as [keyof typeof phases, any][]).map(([key, data]) => {
                  const meta = PHASES_META[key];
                  const isOptional = key === "discover";
                  const isIncluded = !isOptional || data.included;

                  return (
                    <div
                      key={key}
                      className={cn(
                        "bg-background border border-border rounded-xl p-4 transition-all",
                        !isIncluded && "opacity-50"
                      )}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full flex-shrink-0", meta.color)} />
                          <span className="font-bold text-sm text-foreground">{meta.label || key}</span>
                        </div>
                        {isOptional && (
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full leading-tight">
                            Optional
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-3 pl-4 leading-snug">{meta.desc}</p>
                      {isOptional && (
                        <label className="flex items-center gap-2 mb-3 pl-4 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={data.included}
                            onChange={() => setPhases(p => ({ ...p, discover: { ...p.discover, included: !p.discover.included } }))}
                            className="w-3.5 h-3.5 rounded border-border text-primary cursor-pointer"
                          />
                          <span className="text-xs text-muted-foreground">Include in plan</span>
                        </label>
                      )}
                      <div className={cn(
                        "flex items-center gap-2 justify-between",
                        !isIncluded && "pointer-events-none"
                      )}>
                        <button
                          onClick={() => updatePhaseWeeks(key, -1)}
                          disabled={!isIncluded || data.weeks <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-40"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-lg text-foreground tabular-nums w-8 text-center">
                          {data.weeks}
                        </span>
                        <button
                          onClick={() => updatePhaseWeeks(key, 1)}
                          disabled={!isIncluded}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-40"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-xs text-muted-foreground ml-1">wks</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Duration */}
              <div className="flex items-center justify-between bg-muted/40 border border-border rounded-xl px-5 py-4 mt-2">
                <span className="text-sm font-medium text-foreground">Total Duration</span>
                <span className="text-base font-bold text-foreground">
                  {totalWeeks} weeks <span className="text-sm font-normal text-muted-foreground">(~{totalMonths} months)</span>
                </span>
              </div>
            </div>

            {/* GENERATE BUTTON */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-3 bg-secondary text-secondary-foreground font-bold text-base rounded-2xl py-5 shadow-lg hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Generating Plan with AI...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Generate Project Plan</>
              )}
            </button>
          </div>

          {/* SIGN IN SECTION — always visible below generate button */}
          <div className="border-t border-border bg-card/50 px-6 py-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Download className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-foreground text-sm">Sign in to download your plan</h3>
            </div>
            <p className="text-xs text-muted-foreground">Free access. No password. Your plan is waiting.</p>

            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
                I have read and agree to the{" "}
                <button
                  type="button"
                  onClick={() => setIsDisclaimersOpen(true)}
                  className="text-primary font-semibold hover:underline"
                >
                  Disclaimers &amp; Terms of Use
                </button>.
              </span>
            </label>

            {user ? (
              <button
                onClick={handleDownload}
                disabled={!generatedResult || isDownloading || !agreedToTerms}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold rounded-xl py-3 text-sm shadow-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {!generatedResult ? "Generate a plan first" : "Download as Excel"}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <a
                  href="/api/auth/google"
                  onClick={e => {
                    if (!agreedToTerms) {
                      e.preventDefault();
                      toast({ title: "Agreement Required", description: "Please agree to the Disclaimers & Terms of Use first.", variant: "destructive" });
                    }
                  }}
                  className={cn(
                    "flex items-center justify-center gap-2 bg-white text-[#333] border border-[#ddd] font-medium rounded-xl py-3 text-sm shadow-sm hover:bg-gray-50 transition-colors",
                    !agreedToTerms && "opacity-40 pointer-events-none"
                  )}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </a>
                <a
                  href="/api/auth/linkedin"
                  onClick={e => {
                    if (!agreedToTerms) {
                      e.preventDefault();
                      toast({ title: "Agreement Required", description: "Please agree to the Disclaimers & Terms of Use first.", variant: "destructive" });
                    }
                  }}
                  className={cn(
                    "flex items-center justify-center gap-2 bg-[#0A66C2] text-white font-medium rounded-xl py-3 text-sm shadow-sm hover:bg-[#004182] transition-colors",
                    !agreedToTerms && "opacity-40 pointer-events-none"
                  )}
                >
                  <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                  Continue with LinkedIn
                </a>
              </div>
            )}

            <p className="text-xs text-center text-muted-foreground">
              Admin? Sign in with your registered admin email — the Admin panel appears automatically in the header.
            </p>
          </div>
        </div>

        {/* PLAN PREVIEW */}
        <AnimatePresence>
          {generatedResult && (
            <motion.div
              id="plan-preview"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10"
            >
              <PlanPreview plan={generatedResult.plan} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
