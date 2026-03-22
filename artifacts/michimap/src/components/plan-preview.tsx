import { ProjectPlan } from "@workspace/api-client-react/src/generated/api.schemas";
import { PHASES_META, cn } from "@/lib/utils";

interface Props {
  plan: ProjectPlan;
}

export function PlanPreview({ plan }: Props) {
  // Flatten activities for the table
  const rows = plan.phases.flatMap(phase => 
    phase.activities.map((activity, index) => ({
      phase,
      activity,
      isFirstInPhase: index === 0,
      rowspan: phase.activities.length
    }))
  );

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card rounded-2xl shadow-xl shadow-black/5 border border-border overflow-hidden">
        <div className="p-6 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">{plan.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Transition Path: <span className="font-medium text-foreground capitalize">{plan.transitionPath}</span> • 
              Start: <span className="font-medium text-foreground">{plan.projectStartDate}</span> • 
              Duration: <span className="font-medium text-primary">{plan.totalWeeks} weeks</span>
            </p>
          </div>
        </div>

        {plan.summary && (
          <div className="p-6 border-b border-border bg-amber-50/30">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-2">Executive Summary</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">{plan.summary}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/40 sticky top-0">
              <tr>
                <th className="px-4 py-3 font-semibold border-b border-border">Phase</th>
                <th className="px-4 py-3 font-semibold border-b border-border">Category</th>
                <th className="px-4 py-3 font-semibold border-b border-border min-w-[200px]">Activity</th>
                <th className="px-4 py-3 font-semibold border-b border-border min-w-[300px]">Description</th>
                <th className="px-4 py-3 font-semibold border-b border-border">Workstream</th>
                <th className="px-4 py-3 font-semibold border-b border-border">Effort</th>
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
                // Determine phase key for styling
                const phaseKey = Object.keys(PHASES_META).find(
                  k => phase.name.toLowerCase().includes(k.toLowerCase()) || 
                       (k === 'realizeDevelop' && phase.name.toLowerCase().includes('realize'))
                ) as keyof typeof PHASES_META | undefined;
                
                const meta = phaseKey ? PHASES_META[phaseKey] : { color: 'bg-gray-500' };

                return (
                  <tr key={`${phase.name}-${idx}`} className="hover:bg-muted/10 transition-colors">
                    {isFirstInPhase && (
                      <td 
                        rowSpan={rowspan} 
                        className={cn(
                          "px-4 py-3 border-r border-border/50 font-bold text-foreground align-top bg-muted/5 relative",
                        )}
                      >
                        <div className={cn("absolute left-0 top-0 bottom-0 w-1 opacity-50", meta.color)} />
                        {phase.name}
                        <div className="text-xs text-muted-foreground font-normal mt-1">{phase.weeks} wks</div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-muted-foreground">{activity.category}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {activity.activity}
                        {activity.milestone && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase">
                            Milestone
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-normal">{activity.description}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/5 text-secondary border border-secondary/10">
                        {activity.workstream}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{activity.effort}</td>
                    <td className="px-4 py-3 font-medium text-center">{activity.responsible}</td>
                    <td className="px-4 py-3 text-muted-foreground text-center">{activity.accountable}</td>
                    <td className="px-4 py-3 text-muted-foreground text-center">{activity.consulted}</td>
                    <td className="px-4 py-3 text-muted-foreground text-center">{activity.informed}</td>
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
