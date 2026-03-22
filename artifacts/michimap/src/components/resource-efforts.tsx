import { useState, useMemo, useCallback, useRef } from "react";
import { format, addDays } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface Phase { name: string; weeks: number; startDate: string; endDate: string; activities: any[] }
interface Plan  { projectStartDate: string; phases: Phase[]; totalWeeks: number }

type Loc   = "Onsite" | "Offshore";
type Level = "Sol. Architect" | "Sr" | "Jr" | "PM" | "SDM";

interface ResourceRow { id: number; role: string; location: Loc; level: Level }
interface WeekInfo    { weekNum: number; startDate: Date; phaseName: string; phaseHdr: string; phaseLight: string; phaseText: string; year: number }

type EffortMap = Record<number, Record<number, number>>;

// ── Constants ──────────────────────────────────────────────────────────────

const LEVELS: Level[] = ["Sol. Architect", "Sr", "Jr", "PM", "SDM"];

const PHASE_PALETTE: Record<string, { hdr: string; light: string; text: string }> = {
  "Discover":          { hdr: "#3B82F6", light: "#EFF6FF", text: "#1D4ED8" },
  "Prepare":           { hdr: "#16A34A", light: "#F0FDF4", text: "#15803D" },
  "Explore":           { hdr: "#EA580C", light: "#FFF7ED", text: "#C2410C" },
  "Realize - Develop": { hdr: "#CA8A04", light: "#FEFCE8", text: "#92400E" },
  "Realize - UAT":     { hdr: "#DC2626", light: "#FEF2F2", text: "#B91C1C" },
  "Deploy":            { hdr: "#0D9488", light: "#F0FDFA", text: "#0F766E" },
  "Run":               { hdr: "#7C3AED", light: "#FAF5FF", text: "#6D28D9" },
};
const DEFAULT_PALETTE = { hdr: "#6B7280", light: "#F9FAFB", text: "#374151" };

const DEFAULT_RESOURCES: ResourceRow[] = [
  { id: 1, role: "Solution Architect",  location: "Onsite",  level: "Sol. Architect" },
  { id: 2, role: "Sr. Consultant",      location: "Onsite",  level: "Sr" },
  { id: 3, role: "Project Manager",     location: "Onsite",  level: "PM" },
  { id: 4, role: "Delivery Manager",    location: "Onsite",  level: "SDM" },
  { id: 5, role: "Sr. Consultant",      location: "Offshore", level: "Sr" },
  { id: 6, role: "Jr. Consultant",      location: "Offshore", level: "Jr" },
];

const DARK = "#1A1A2E";
const GOLD = "#E9A944";

// ── Main component ─────────────────────────────────────────────────────────

export function ResourceEffortsPanel({ plan }: { plan: Plan }) {
  const [resources, setResources] = useState<ResourceRow[]>(DEFAULT_RESOURCES);
  const [efforts,   setEfforts  ] = useState<EffortMap>({});
  const [locFilter, setLocFilter] = useState<"All" | "Onsite" | "Offshore">("All");
  const nextId = useRef(DEFAULT_RESOURCES.length + 1);

  // Build ordered week list from plan phases
  const weeks = useMemo<WeekInfo[]>(() => {
    const start = new Date(plan.projectStartDate + "T12:00:00");
    const out: WeekInfo[] = [];
    let offset = 0;
    for (const ph of plan.phases) {
      const pal = PHASE_PALETTE[ph.name] || DEFAULT_PALETTE;
      for (let pw = 0; pw < ph.weeks; pw++) {
        const wn = offset + pw + 1;
        const sd = addDays(start, (wn - 1) * 7);
        out.push({ weekNum: wn, startDate: sd, phaseName: ph.name,
                   phaseHdr: pal.hdr, phaseLight: pal.light, phaseText: pal.text,
                   year: sd.getFullYear() });
      }
      offset += ph.weeks;
    }
    return out;
  }, [plan]);

  // Collapsed phase groups for header colspan
  const phaseGroups = useMemo(() => {
    const groups: { name: string; hdr: string; count: number }[] = [];
    for (const w of weeks) {
      const last = groups[groups.length - 1];
      if (last && last.name === w.phaseName) { last.count++; }
      else groups.push({ name: w.phaseName, hdr: w.phaseHdr, count: 1 });
    }
    return groups;
  }, [weeks]);

  // Helpers
  const setEffort = useCallback((rowId: number, weekNum: number, val: number) => {
    setEfforts(prev => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [weekNum]: val } }));
  }, []);

  const getRowTotal = (id: number) =>
    Object.values(efforts[id] || {}).reduce((s, v) => s + v, 0);

  const addRow = () => {
    setResources(prev => [...prev, { id: nextId.current++, role: "Consultant", location: "Onsite", level: "Sr" }]);
  };

  const removeRow = (id: number) => {
    setResources(prev => prev.filter(r => r.id !== id));
    setEfforts(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const updateRes = (id: number, patch: Partial<ResourceRow>) =>
    setResources(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  // Filtered rows for pivot
  const pivotRows = useMemo(
    () => locFilter === "All" ? resources : resources.filter(r => r.location === locFilter),
    [resources, locFilter]
  );

  // Pivot 1: Phase × Level
  const phasePivot = useMemo(() => {
    const p: Record<string, Record<Level, number>> = {};
    for (const ph of plan.phases) {
      p[ph.name] = {} as Record<Level, number>;
      for (const lv of LEVELS) p[ph.name][lv] = 0;
    }
    for (const res of pivotRows) {
      const re = efforts[res.id] || {};
      for (const w of weeks) {
        const d = re[w.weekNum] || 0;
        if (d && p[w.phaseName]) p[w.phaseName][res.level] += d;
      }
    }
    return p;
  }, [pivotRows, efforts, weeks, plan.phases]);

  // Pivot 2: Year × Level
  const { yearPivot, years } = useMemo(() => {
    const ys = [...new Set(weeks.map(w => w.year))].sort();
    const yp: Record<number, Record<Level, number>> = {};
    for (const y of ys) { yp[y] = {} as Record<Level, number>; for (const lv of LEVELS) yp[y][lv] = 0; }
    for (const res of pivotRows) {
      const re = efforts[res.id] || {};
      for (const w of weeks) {
        const d = re[w.weekNum] || 0;
        if (d) yp[w.year][res.level] += d;
      }
    }
    return { yearPivot: yp, years: ys };
  }, [pivotRows, efforts, weeks]);

  const phaseTotal  = (ph: string)  => LEVELS.reduce((s, l) => s + (phasePivot[ph]?.[l] || 0), 0);
  const levelPhTot  = (lv: Level)   => plan.phases.reduce((s, p) => s + (phasePivot[p.name]?.[lv] || 0), 0);
  const grandTotal  = ()            => LEVELS.reduce((s, l) => s + levelPhTot(l), 0);
  const yearLvTot   = (y: number)   => LEVELS.reduce((s, l) => s + (yearPivot[y]?.[l] || 0), 0);
  const lvAllYrTot  = (lv: Level)   => years.reduce((s, y) => s + (yearPivot[y]?.[lv] || 0), 0);
  const grandYrTot  = ()            => years.reduce((s, y) => s + yearLvTot(y), 0);

  // Fixed column widths
  const ROLE_W = 120;
  const LOC_W  = 80;
  const LEV_W  = 100;
  const WK_W   = 46;
  const TOT_W  = 52;

  return (
    <div className="space-y-5">

      {/* ── Gantt Table ─────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-card">
          <div>
            <p className="font-bold text-sm text-foreground">Resource Effort Gantt</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Enter days (0–5) per week. Phase bands are colour-coded. Pivots update live.
            </p>
          </div>
          <button onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="border-collapse"
            style={{ minWidth: `${ROLE_W + LOC_W + LEV_W + weeks.length * WK_W + TOT_W}px` }}>
            <thead>
              {/* Row 1 — phase bands */}
              <tr>
                <th colSpan={3} style={{ width: ROLE_W + LOC_W + LEV_W, minWidth: ROLE_W + LOC_W + LEV_W,
                    position: "sticky", left: 0, zIndex: 30, backgroundColor: DARK, color: "#fff" }}
                  className="text-left px-3 py-2 text-[11px] font-bold border-r-2 border-[#333]">
                  Resource
                </th>
                {phaseGroups.map((g, gi) => (
                  <th key={gi} colSpan={g.count}
                    style={{ backgroundColor: g.hdr, color: "#fff", width: g.count * WK_W }}
                    className="text-center py-1.5 px-1 text-[10px] font-semibold border-r border-white/20 whitespace-nowrap">
                    {g.name}
                  </th>
                ))}
                <th style={{ width: TOT_W, backgroundColor: DARK, color: "#fff" }}
                  className="text-center px-2 py-2 text-[11px] font-bold">
                  Total
                </th>
              </tr>
              {/* Row 2 — column headers */}
              <tr>
                <th style={{ width: ROLE_W, minWidth: ROLE_W, position: "sticky", left: 0, zIndex: 30, backgroundColor: DARK, color: "#fff" }}
                  className="text-left px-3 py-1.5 text-[10px] font-semibold border-r border-[#333]">Role</th>
                <th style={{ width: LOC_W, minWidth: LOC_W, position: "sticky", left: ROLE_W, zIndex: 30, backgroundColor: DARK, color: "#fff" }}
                  className="text-center px-2 py-1.5 text-[10px] font-semibold border-r border-[#333]">Location</th>
                <th style={{ width: LEV_W, minWidth: LEV_W, position: "sticky", left: ROLE_W + LOC_W, zIndex: 30, backgroundColor: DARK, color: "#fff" }}
                  className="text-center px-1 py-1.5 text-[10px] font-semibold border-r-2 border-[#444]">Level</th>
                {weeks.map(w => (
                  <th key={w.weekNum}
                    style={{ width: WK_W, minWidth: WK_W, backgroundColor: `${w.phaseHdr}28`, color: "#374151" }}
                    className="text-center py-1 border-r border-border">
                    <div className="text-[10px] font-bold leading-tight">W{w.weekNum}</div>
                    <div className="text-[8px] text-muted-foreground leading-tight">{format(w.startDate, "MMM d")}</div>
                  </th>
                ))}
                <th style={{ width: TOT_W, backgroundColor: DARK, color: "#fff" }}
                  className="text-center px-2 py-1.5 text-[10px] font-semibold">Days</th>
              </tr>
            </thead>

            <tbody>
              {resources.map((res, ri) => {
                const rowBg = ri % 2 === 0 ? "#FFFFFF" : "#F9FAFB";
                const total = getRowTotal(res.id);
                return (
                  <tr key={res.id} style={{ backgroundColor: rowBg }}>
                    {/* Role */}
                    <td style={{ width: ROLE_W, minWidth: ROLE_W, position: "sticky", left: 0, zIndex: 10, backgroundColor: rowBg }}
                      className="border-r border-[#E5E7EB] px-2 py-1">
                      <input value={res.role}
                        onChange={e => updateRes(res.id, { role: e.target.value })}
                        className="w-full bg-transparent text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 py-0.5" />
                    </td>
                    {/* Location */}
                    <td style={{ width: LOC_W, minWidth: LOC_W, position: "sticky", left: ROLE_W, zIndex: 10, backgroundColor: rowBg }}
                      className="border-r border-[#E5E7EB] px-1 py-1 text-center">
                      <select value={res.location}
                        onChange={e => updateRes(res.id, { location: e.target.value as Loc })}
                        className="w-full bg-transparent text-[10px] text-foreground focus:outline-none cursor-pointer text-center appearance-none">
                        <option>Onsite</option>
                        <option>Offshore</option>
                      </select>
                    </td>
                    {/* Level + delete */}
                    <td style={{ width: LEV_W, minWidth: LEV_W, position: "sticky", left: ROLE_W + LOC_W, zIndex: 10, backgroundColor: rowBg }}
                      className="border-r-2 border-[#D1D5DB] px-1 py-1">
                      <div className="flex items-center gap-1">
                        <select value={res.level}
                          onChange={e => updateRes(res.id, { level: e.target.value as Level })}
                          className="flex-1 bg-transparent text-[10px] text-foreground focus:outline-none cursor-pointer appearance-none">
                          {LEVELS.map(l => <option key={l}>{l}</option>)}
                        </select>
                        <button onClick={() => removeRow(res.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-0.5">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    {/* Week cells */}
                    {weeks.map(w => {
                      const val = (efforts[res.id] || {})[w.weekNum] || 0;
                      return (
                        <td key={w.weekNum}
                          style={{ width: WK_W, minWidth: WK_W,
                                   backgroundColor: val > 0 ? `${w.phaseHdr}22` : rowBg }}
                          className="border-r border-border px-0.5 py-0.5 text-center">
                          <input
                            type="number" min={0} max={5} step={0.5}
                            value={val || ""}
                            placeholder="·"
                            onChange={e => setEffort(res.id, w.weekNum, Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)))}
                            className="w-[38px] h-[22px] text-center text-xs font-mono rounded focus:outline-none focus:ring-1 focus:ring-primary/50 bg-transparent placeholder:text-muted-foreground/25 tabular-nums" />
                        </td>
                      );
                    })}
                    {/* Total */}
                    <td style={{ width: TOT_W, color: total > 0 ? "#15803D" : "#9CA3AF" }}
                      className="text-center px-2 py-1 font-bold text-xs tabular-nums">
                      {total || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pivot section ───────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Location filter */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Pivot filter:</span>
          <div className="flex gap-1.5">
            {(["All", "Onsite", "Offshore"] as const).map(f => (
              <button key={f} onClick={() => setLocFilter(f)}
                className={cn("px-3 py-1 rounded-full text-xs font-semibold transition-all",
                  locFilter === f
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80")}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          {/* Pivot 1 — Phase × Level */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5" style={{ backgroundColor: DARK }}>
              <p className="text-xs font-bold text-white">Effort by Phase &amp; Level (days)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="text-left px-3 py-2 font-bold text-foreground border-b border-border">Phase</th>
                    {LEVELS.map(l => (
                      <th key={l} className="text-center px-2 py-2 font-bold text-foreground border-b border-border whitespace-nowrap">{l}</th>
                    ))}
                    <th className="text-center px-2 py-2 font-bold text-primary border-b border-border">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.phases.map((ph, pi) => {
                    const row = phasePivot[ph.name] || {};
                    const tot = phaseTotal(ph.name);
                    const pal = PHASE_PALETTE[ph.name] || DEFAULT_PALETTE;
                    return (
                      <tr key={pi} style={{ backgroundColor: pi % 2 === 0 ? "#fff" : "#F9FAFB" }}>
                        <td className="px-3 py-2 font-semibold" style={{ color: pal.text }}>{ph.name}</td>
                        {LEVELS.map(l => (
                          <td key={l} className="text-center px-2 py-2 tabular-nums"
                            style={{ color: (row[l] || 0) > 0 ? "#111827" : "#9CA3AF" }}>
                            {row[l] || 0}
                          </td>
                        ))}
                        <td className="text-center px-2 py-2 font-bold tabular-nums"
                          style={{ color: tot > 0 ? "#15803D" : "#9CA3AF" }}>{tot}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ backgroundColor: DARK, color: "#fff" }}>
                    <td className="px-3 py-2 font-bold text-[11px]">TOTAL</td>
                    {LEVELS.map(l => (
                      <td key={l} className="text-center px-2 py-2 font-bold tabular-nums">{levelPhTot(l)}</td>
                    ))}
                    <td className="text-center px-2 py-2 font-bold tabular-nums" style={{ color: GOLD }}>{grandTotal()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Pivot 2 — Year × Level */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5" style={{ backgroundColor: DARK }}>
              <p className="text-xs font-bold text-white">Effort by Year &amp; Level (days)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="text-left px-3 py-2 font-bold text-foreground border-b border-border">Level</th>
                    {years.map(y => (
                      <th key={y} className="text-center px-2 py-2 font-bold text-foreground border-b border-border">{y}</th>
                    ))}
                    <th className="text-center px-2 py-2 font-bold text-primary border-b border-border">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {LEVELS.map((lv, li) => {
                    const tot = lvAllYrTot(lv);
                    return (
                      <tr key={lv} style={{ backgroundColor: li % 2 === 0 ? "#fff" : "#F9FAFB" }}>
                        <td className="px-3 py-2 font-semibold text-foreground">{lv}</td>
                        {years.map(y => (
                          <td key={y} className="text-center px-2 py-2 tabular-nums"
                            style={{ color: (yearPivot[y]?.[lv] || 0) > 0 ? "#111827" : "#9CA3AF" }}>
                            {yearPivot[y]?.[lv] || 0}
                          </td>
                        ))}
                        <td className="text-center px-2 py-2 font-bold tabular-nums"
                          style={{ color: tot > 0 ? "#15803D" : "#9CA3AF" }}>{tot}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ backgroundColor: DARK, color: "#fff" }}>
                    <td className="px-3 py-2 font-bold text-[11px]">TOTAL</td>
                    {years.map(y => (
                      <td key={y} className="text-center px-2 py-2 font-bold tabular-nums">{yearLvTot(y)}</td>
                    ))}
                    <td className="text-center px-2 py-2 font-bold tabular-nums" style={{ color: GOLD }}>{grandYrTot()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
