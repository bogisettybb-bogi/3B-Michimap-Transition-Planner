import React from "react";
import { format, addWeeks } from "date-fns";
import { cn } from "@/lib/utils";

interface Activity {
  category: string;
  activity: string;
  responsible: string;
  startWeek: number;
  endWeek: number;
  milestone: boolean;
}

interface Phase {
  name: string;
  startDate: string;
  endDate: string;
  weeks: number;
  activities: Activity[];
}

interface Plan {
  title: string;
  transitionPath: string;
  projectStartDate: string;
  phases: Phase[];
  totalWeeks: number;
  summary?: string;
}

const PHASE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  "Discover":       { bg: "bg-blue-100",   text: "text-blue-700",   bar: "bg-blue-400" },
  "Prepare":        { bg: "bg-green-100",  text: "text-green-700",  bar: "bg-green-500" },
  "Explore":        { bg: "bg-orange-100", text: "text-orange-700", bar: "bg-orange-400" },
  "Realize - Develop": { bg: "bg-yellow-100", text: "text-yellow-700", bar: "bg-yellow-500" },
  "Realize - UAT":  { bg: "bg-red-100",    text: "text-red-700",    bar: "bg-red-400" },
  "Deploy":         { bg: "bg-teal-100",   text: "text-teal-700",   bar: "bg-teal-500" },
  "Run":            { bg: "bg-purple-100", text: "text-purple-700", bar: "bg-purple-400" },
};

export function PlanPreview({ plan }: { plan: Plan }) {
  const startDate = plan.projectStartDate ? new Date(plan.projectStartDate + "T12:00:00") : new Date();
  const endDate = addWeeks(startDate, plan.totalWeeks);
  const months = (plan.totalWeeks / 4.33).toFixed(1);

  const milestones = plan.phases.flatMap(p =>
    p.activities.filter(a => a.milestone).map(a => ({ phase: p.name, activity: a.activity, week: a.endWeek }))
  );

  return (
    <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">

      {/* Header banner */}
      <div className="bg-[#1A1A2E] px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-white/50 uppercase tracking-widest font-medium mb-0.5">Project Plan Preview</div>
          <h2 className="text-lg font-bold text-white capitalize">
            {plan.transitionPath} — SAP S/4HANA Activate Plan
          </h2>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold text-[#E9A944]">{plan.totalWeeks}w</div>
          <div className="text-xs text-white/60">{months} months</div>
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* Key stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Start", value: format(startDate, "d MMM yyyy") },
            { label: "Go-live", value: format(endDate, "MMM yyyy") },
            { label: "Phases", value: `${plan.phases.length} phases` },
          ].map(s => (
            <div key={s.label} className="bg-muted/40 rounded-xl px-4 py-3 text-center">
              <div className="text-xs text-muted-foreground mb-0.5">{s.label}</div>
              <div className="text-sm font-bold text-foreground">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Executive summary */}
        {plan.summary && (
          <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest font-bold text-primary mb-1">AI Executive Summary</div>
            <p className="text-sm text-foreground/80 leading-relaxed">{plan.summary}</p>
          </div>
        )}

        {/* Phase timeline — cascading waterfall */}
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-3">Phase Timeline</div>
          <div className="space-y-1.5">
            {(() => {
              let weekOffset = 0;
              const rows: React.ReactNode[] = [];

              plan.phases.forEach((phase) => {
                const colors = PHASE_COLORS[phase.name] || { bg: "bg-gray-100", text: "text-gray-700", bar: "bg-gray-400" };
                const offsetPct = (weekOffset / plan.totalWeeks) * 100;
                const widthPct  = Math.max((phase.weeks / plan.totalWeeks) * 100, 5);
                const acts = phase.activities.length;
                const isDeployPhase = phase.name === "Deploy";

                rows.push(
                  <div key={phase.name} className="flex items-center gap-3">
                    {/* Phase label */}
                    <div className={cn("text-[10px] font-bold w-28 shrink-0 truncate", colors.text)}>
                      {phase.name}
                    </div>

                    {/* Track */}
                    <div className="flex-1 relative h-6">
                      {/* Background track */}
                      <div className="absolute inset-y-0 left-0 right-0 bg-muted rounded-full" />

                      {/* Colored phase bar */}
                      <div
                        className={cn("absolute inset-y-0 rounded-full flex items-center justify-center transition-all", colors.bar)}
                        style={{ left: `${offsetPct}%`, width: `${widthPct}%` }}
                      >
                        <span className="text-[9px] text-white font-bold px-1 truncate">{phase.weeks}w</span>
                      </div>

                      {/* GO-LIVE marker — pin at end of Deploy */}
                      {isDeployPhase && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center z-10"
                          style={{ left: `${offsetPct + widthPct}%`, transform: "translateX(-50%) translateY(-50%)" }}
                        >
                          <div className="w-0.5 h-6 bg-red-500" />
                        </div>
                      )}
                    </div>

                    {/* Activity count */}
                    <div className="text-[10px] text-muted-foreground w-16 shrink-0 text-right">
                      {acts} {acts === 1 ? "activity" : "activities"}
                    </div>
                  </div>
                );

                // GO-LIVE banner inserted after Deploy row
                if (isDeployPhase) {
                  const goLivePct = offsetPct + widthPct;
                  rows.push(
                    <div key="go-live" className="flex items-center gap-3 py-1">
                      <div className="w-28 shrink-0" />
                      <div className="flex-1 relative">
                        <div
                          className="absolute flex items-center gap-1.5"
                          style={{ left: `${goLivePct}%`, transform: "translateX(-50%)" }}
                        >
                          <div className="flex items-center gap-1 bg-red-500 text-white text-[9px] font-black px-2.5 py-1 rounded-full shadow-md whitespace-nowrap">
                            <span>★</span>
                            <span>GO-LIVE</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-16 shrink-0" />
                    </div>
                  );
                }

                weekOffset += phase.weeks;
              });

              return rows;
            })()}
          </div>
        </div>

        {/* Milestones */}
        {milestones.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Key Milestones</div>
            <div className="flex flex-wrap gap-2">
              {milestones.map((m, i) => {
                const colors = PHASE_COLORS[m.phase] || { bg: "bg-gray-100", text: "text-gray-700" };
                return (
                  <div key={i} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium", colors.bg, colors.text)}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                    <span className="truncate max-w-[140px]" title={m.activity}>{m.activity}</span>
                    <span className="opacity-60">Wk {m.week}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/60 text-center pt-1 border-t border-border">
          Full Gantt chart + Resource Pivot available in the Excel download
        </p>
      </div>
    </div>
  );
}
