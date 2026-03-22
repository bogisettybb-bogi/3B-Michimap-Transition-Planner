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
  effortPct?: string;
  notes?: string;
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

const PHASE_COLORS: Record<string, { bg: string; text: string; bar: string; row: string; hdr: string }> = {
  "Discover":          { bg: "bg-blue-100",   text: "text-blue-700",   bar: "bg-blue-400",   row: "bg-blue-50",   hdr: "bg-blue-500" },
  "Prepare":           { bg: "bg-green-100",  text: "text-green-700",  bar: "bg-green-500",  row: "bg-green-50",  hdr: "bg-green-600" },
  "Explore":           { bg: "bg-orange-100", text: "text-orange-700", bar: "bg-orange-400", row: "bg-orange-50", hdr: "bg-orange-500" },
  "Realize - Develop": { bg: "bg-yellow-100", text: "text-yellow-700", bar: "bg-yellow-500", row: "bg-yellow-50", hdr: "bg-yellow-600" },
  "Realize - UAT":     { bg: "bg-red-100",    text: "text-red-700",    bar: "bg-red-400",    row: "bg-red-50",    hdr: "bg-red-600" },
  "Deploy":            { bg: "bg-teal-100",   text: "text-teal-700",   bar: "bg-teal-500",   row: "bg-teal-50",   hdr: "bg-teal-600" },
  "Run":               { bg: "bg-purple-100", text: "text-purple-700", bar: "bg-purple-400", row: "bg-purple-50", hdr: "bg-purple-500" },
};

export function PlanPreview({ plan }: { plan: Plan }) {
  const startDate = plan.projectStartDate ? new Date(plan.projectStartDate + "T12:00:00") : new Date();
  const endDate = addWeeks(startDate, plan.totalWeeks);
  const months = (plan.totalWeeks / 4.33).toFixed(1);

  const milestones = plan.phases.flatMap(p =>
    p.activities.filter(a => a.milestone).map(a => ({ phase: p.name, activity: a.activity, week: a.endWeek }))
  );

  const weekToDate = (week: number) => format(addWeeks(startDate, week - 1), "d MMM yyyy");

  const deployPhase = plan.phases.find(p => p.name === "Deploy");
  const goLiveDate  = deployPhase
    ? format(new Date(deployPhase.endDate + "T12:00:00"), "d MMM yyyy")
    : format(endDate, "d MMM yyyy");

  return (
    <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">

      {/* Header banner */}
      <div className="bg-[#1A1A2E] px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-white/50 uppercase tracking-widest font-medium mb-0.5">Project Plan Preview</div>
          <h2 className="text-lg font-bold text-white capitalize">
            {plan.transitionPath} - SAP S/4HANA Activate Plan
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
            { label: "Go-live", value: format(endDate, "d MMM yyyy") },
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

        {/* SAP Activate Timeline */}
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-3">SAP Activate Timeline</div>
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

                const goLivePct = offsetPct + widthPct;

                rows.push(
                  <div key={phase.name} className="flex items-center gap-3" style={{ paddingTop: isDeployPhase ? "22px" : 0 }}>
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

                      {/* GO-LIVE badge + vertical pin - sits above the Deploy bar */}
                      {isDeployPhase && (
                        <>
                          <div
                            className="absolute z-10"
                            style={{
                              left: `${goLivePct}%`,
                              transform: "translateX(-50%)",
                              bottom: 0,
                              width: "2px",
                              height: "calc(100% + 20px)",
                              background: "#EF4444",
                            }}
                          />
                          <div
                            className="absolute z-20 flex items-center gap-1 bg-red-500 text-white text-[9px] font-black px-2.5 py-[3px] rounded-full shadow-md whitespace-nowrap"
                            style={{
                              left: `${goLivePct}%`,
                              transform: "translateX(-50%)",
                              bottom: "calc(100% + 6px)",
                            }}
                          >
                            <span>★</span>
                            <span>GO-LIVE · {goLiveDate}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Activity count */}
                    <div className="text-[10px] text-muted-foreground w-16 shrink-0 text-right">
                      {acts} {acts === 1 ? "activity" : "activities"}
                    </div>
                  </div>
                );

                weekOffset += phase.weeks;
              });

              return rows;
            })()}
          </div>
        </div>

        {/* Milestones - show actual dates */}
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
                    <span className="opacity-70 font-semibold">{weekToDate(m.week)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Phase-wise Activity Table */}
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Activity Plan by Phase</div>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-y-auto" style={{ maxHeight: "340px" }}>
              <table className="w-full text-[10px] border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#1A1A2E] text-white">
                    <th className="text-left px-2.5 py-2 font-semibold w-[105px] shrink-0">Phase</th>
                    <th className="text-left px-2.5 py-2 font-semibold">Activity</th>
                    <th className="text-left px-2.5 py-2 font-semibold w-[110px]">Responsible</th>
                    <th className="text-center px-2 py-2 font-semibold w-[80px]">Effort guideline</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.phases.flatMap((phase, pi) => {
                    const colors = PHASE_COLORS[phase.name] || { hdr: "bg-gray-500", row: "bg-gray-50", text: "text-gray-700", bg: "bg-gray-100" };
                    return phase.activities.map((act, ai) => (
                      <tr
                        key={`${pi}-${ai}`}
                        className={cn(
                          "border-b border-border/40 hover:brightness-95 transition-colors",
                          act.milestone ? "font-semibold" : "",
                          ai % 2 === 0 ? colors.row : "bg-white"
                        )}
                      >
                        {ai === 0 ? (
                          <td
                            rowSpan={phase.activities.length}
                            className={cn("px-2.5 py-2 align-top border-r border-border/30 font-bold", colors.text, colors.bg)}
                            style={{ verticalAlign: "top" }}
                          >
                            <div className="sticky top-0">
                              <div>{phase.name}</div>
                              <div className="text-[9px] opacity-60 font-normal mt-0.5">{phase.weeks}w</div>
                            </div>
                          </td>
                        ) : null}
                        <td className="px-2.5 py-1.5 text-foreground/85 leading-snug">
                          {act.milestone && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 align-middle opacity-60" />}
                          {act.activity}
                        </td>
                        <td className="px-2.5 py-1.5 text-muted-foreground">{act.responsible || "-"}</td>
                        <td className="px-2 py-1.5 text-center font-bold text-muted-foreground">{act.effortPct || "-"}</td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/60 text-center pt-1 border-t border-border">
          Full Gantt chart + Resource Pivot available in the Excel download
        </p>
      </div>
    </div>
  );
}
