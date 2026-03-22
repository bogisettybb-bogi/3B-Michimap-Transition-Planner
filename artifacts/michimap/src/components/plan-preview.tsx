import { PHASES_META, cn } from "@/lib/utils";

interface Activity {
  category: string;
  activity: string;
  description: string;
  workstream: string;
  responsible: string;
  accountable: string;
  consulted: string;
  informed: string;
  startWeek: number;
  endWeek: number;
  duration: string;
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

interface Props {
  plan: Plan;
}

export function PlanPreview({ plan }: Props) {
  const rows = plan.phases.flatMap(phase =>
    phase.activities.map((activity, index) => ({
      phase,
      activity,
      isFirstInPhase: index === 0,
      rowspan: phase.activities.length,
    }))
  );

  return (
    <div className="w-full">
      <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">

        {/* Header */}
        <div className="p-6 border-b border-border bg-muted/20">
          <h2 className="text-xl font-bold text-foreground">{plan.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Transition Path: <span className="font-medium text-foreground capitalize">{plan.transitionPath}</span>
            {" "}&middot;{" "}
            Start: <span className="font-medium text-foreground">{plan.projectStartDate}</span>
            {" "}&middot;{" "}
            Duration: <span className="font-medium text-primary">{plan.totalWeeks} weeks</span>
          </p>
        </div>

        {/* Executive Summary */}
        {plan.summary && (
          <div className="px-6 py-4 border-b border-border bg-amber-50/40">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-1.5">Executive Summary</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">{plan.summary}</p>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/40">
              <tr>
                <th className="px-4 py-3 font-semibold border-b border-border">Phase</th>
                <th className="px-4 py-3 font-semibold border-b border-border">Category</th>
                <th className="px-4 py-3 font-semibold border-b border-border min-w-[200px]">Activity</th>
                <th className="px-4 py-3 font-semibold border-b border-border min-w-[280px]">Description</th>
                <th className="px-4 py-3 font-semibold border-b border-border">Workstream</th>
                <th className="px-4 py-3 font-semibold border-b border-border">R</th>
                <th className="px-4 py-3 font-semibold border-b border-border">A</th>
                <th className="px-4 py-3 font-semibold border-b border-border">C</th>
                <th className="px-4 py-3 font-semibold border-b border-border">I</th>
                <th className="px-4 py-3 font-semibold border-b border-border text-center">Wk Start</th>
                <th className="px-4 py-3 font-semibold border-b border-border text-center">Wk End</th>
                <th className="px-4 py-3 font-semibold border-b border-border text-center">Dur.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map(({ phase, activity, isFirstInPhase, rowspan }, idx) => {
                const phaseKey = Object.keys(PHASES_META).find(k =>
                  phase.name.toLowerCase().replace(/[\s-]/g, "").includes(k.toLowerCase().replace(/[\s-]/g, ""))
                ) as keyof typeof PHASES_META | undefined;

                const meta = phaseKey ? PHASES_META[phaseKey] : { color: "bg-gray-400" };

                return (
                  <tr key={`${phase.name}-${idx}`} className="hover:bg-muted/10 transition-colors">
                    {isFirstInPhase && (
                      <td rowSpan={rowspan} className="px-4 py-3 border-r border-border/50 font-bold text-foreground align-top bg-muted/5 relative">
                        <div className={cn("absolute left-0 top-0 bottom-0 w-1 opacity-60", meta.color)} />
                        <span className="pl-1">{phase.name}</span>
                        <div className="text-xs text-muted-foreground font-normal mt-0.5">{phase.weeks} weeks</div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-muted-foreground text-xs">{activity.category}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {activity.activity}
                        {activity.milestone && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary uppercase tracking-wide">
                            Milestone
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-normal leading-snug">{activity.description}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary/10 text-secondary border border-secondary/20">
                        {activity.workstream}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{activity.responsible}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{activity.accountable}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{activity.consulted}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{activity.informed}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">{activity.startWeek}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">{activity.endWeek}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">{activity.duration}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
