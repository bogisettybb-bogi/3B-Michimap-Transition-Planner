import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays } from "date-fns";
import { Plus, Trash2, Download, CheckCircle2, Loader2, Share2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface Phase { name: string; weeks: number; startDate: string; endDate: string; activities: any[] }
interface Plan  { projectStartDate: string; phases: Phase[]; totalWeeks: number }

type Loc   = "Onsite" | "Offshore";
type Level = "Solution Architect" | "Senior Consultant" | "Junior Consultant" | "Project Manager" | "Service Delivery Manager" | "Functional Consultant" | "AI Consultant";

interface ResourceRow {
  id: number; role: string; location: Loc; level: Level; remarks: string;
}
interface WeekInfo {
  weekNum: number; startDate: Date; phaseName: string; phaseHdr: string; year: number;
}

type EffortMap = Record<number, Record<number, number>>;

export interface ResourceRowExport {
  role: string; location: Loc; level: Level; remarks: string;
  weekEfforts: Record<number, number>;
}

export interface ResourceEffortsProps {
  plan: Plan;
  agreedToTerms: boolean;
  setAgreedToTerms: (v: boolean) => void;
  onOpenDisclaimers: () => void;
  isDownloading: boolean;
  onDownload: () => void;
  hasDownloaded: boolean;
  xShareUrl: string;
  linkedInShareUrl: string;
  onConfirm: () => void;
  onUnconfirm: () => void;
  onDataChange?: (rows: ResourceRowExport[]) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const LEVELS: Level[] = ["Solution Architect", "Senior Consultant", "Junior Consultant", "Project Manager", "Service Delivery Manager", "Functional Consultant", "AI Consultant"];

const PHASE_PALETTE: Record<string, { hdr: string; text: string }> = {
  "Discover":          { hdr: "#3B82F6", text: "#1D4ED8" },
  "Prepare":           { hdr: "#16A34A", text: "#15803D" },
  "Explore":           { hdr: "#EA580C", text: "#C2410C" },
  "Realize - Develop": { hdr: "#CA8A04", text: "#92400E" },
  "Realize - UAT":     { hdr: "#DC2626", text: "#B91C1C" },
  "Deploy":            { hdr: "#0D9488", text: "#0F766E" },
  "Run":               { hdr: "#7C3AED", text: "#6D28D9" },
};
const DEFAULT_PAL = { hdr: "#6B7280", text: "#374151" };

const DEFAULT_RESOURCES: ResourceRow[] = [
  { id: 1, role: "Solution Architect",  location: "Onsite",   level: "Solution Architect",      remarks: "" },
  { id: 2, role: "Sr. Consultant",      location: "Onsite",   level: "Senior Consultant",       remarks: "" },
  { id: 3, role: "Project Manager",     location: "Onsite",   level: "Project Manager",         remarks: "" },
  { id: 4, role: "Delivery Manager",    location: "Onsite",   level: "Service Delivery Manager", remarks: "" },
  { id: 5, role: "Sr. Consultant",      location: "Offshore", level: "Senior Consultant",       remarks: "" },
  { id: 6, role: "Jr. Consultant",      location: "Offshore", level: "Junior Consultant",       remarks: "" },
];

const DARK = "#1A1A2E";
const GOLD = "#E9A944";

// Frozen column widths (px) — these stay sticky
const ACT_W  = 52;   // + / trash actions
const ROLE_W = 130;
const LOC_W  = 78;
const LEV_W  = 100;
const REM_W  = 130;  // Remarks free text
const FROZEN = ACT_W + ROLE_W + LOC_W + LEV_W + REM_W; // 490

// Scrollable column widths
const WK_W   = 52;   // week columns (wider for full date)
const TOT_W  = 56;   // row total

// ── Helpers ────────────────────────────────────────────────────────────────

const round1 = (v: number) => Math.round(v * 10) / 10;

// ── Main component ─────────────────────────────────────────────────────────

export function ResourceEffortsPanel({
  plan, agreedToTerms, setAgreedToTerms, onOpenDisclaimers,
  isDownloading, onDownload, hasDownloaded, xShareUrl, linkedInShareUrl,
  onConfirm, onUnconfirm, onDataChange,
}: ResourceEffortsProps) {
  const [resources, setResources] = useState<ResourceRow[]>(DEFAULT_RESOURCES);
  const [efforts,   setEfforts  ] = useState<EffortMap>({});
  const [locFilter, setLocFilter] = useState<"All" | "Onsite" | "Offshore">("All");
  const [confirmed, setConfirmed] = useState(false);
  const nextId = useRef(DEFAULT_RESOURCES.length + 1);

  // ── Notify parent of current data whenever resources/efforts change ───────
  useEffect(() => {
    if (!onDataChange) return;
    onDataChange(
      resources.map(r => ({ role: r.role, location: r.location, level: r.level, remarks: r.remarks, weekEfforts: efforts[r.id] || {} }))
    );
  }, [resources, efforts, onDataChange]);

  // ── Week list ─────────────────────────────────────────────────────────────

  const weeks = useMemo<WeekInfo[]>(() => {
    const start = new Date(plan.projectStartDate + "T12:00:00");
    const out: WeekInfo[] = [];
    let offset = 0;
    for (const ph of plan.phases) {
      const pal = PHASE_PALETTE[ph.name] || DEFAULT_PAL;
      for (let pw = 0; pw < ph.weeks; pw++) {
        const wn = offset + pw + 1;
        const sd = addDays(start, (wn - 1) * 7);
        out.push({ weekNum: wn, startDate: sd, phaseName: ph.name, phaseHdr: pal.hdr, year: sd.getFullYear() });
      }
      offset += ph.weeks;
    }
    return out;
  }, [plan]);

  // Grouped phase headers (for colspan)
  const phaseGroups = useMemo(() => {
    const gs: { name: string; hdr: string; count: number }[] = [];
    for (const w of weeks) {
      const last = gs[gs.length - 1];
      if (last && last.name === w.phaseName) last.count++;
      else gs.push({ name: w.phaseName, hdr: w.phaseHdr, count: 1 });
    }
    return gs;
  }, [weeks]);

  // ── Row operations ────────────────────────────────────────────────────────

  const insertRowAfter = (afterId: number) => {
    setResources(prev => {
      const idx = prev.findIndex(r => r.id === afterId);
      const newRow: ResourceRow = { id: nextId.current++, role: "Consultant", location: "Onsite", level: "Sr", remarks: "" };
      const next = [...prev];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
  };

  const removeRow = (id: number) => {
    setResources(prev => prev.filter(r => r.id !== id));
    setEfforts(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const duplicateRow = (srcId: number) => {
    const newId = nextId.current++;
    setResources(prev => {
      const idx = prev.findIndex(r => r.id === srcId);
      const src = prev[idx];
      const copy: ResourceRow = { ...src, id: newId };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setEfforts(prev => ({ ...prev, [newId]: { ...(prev[srcId] || {}) } }));
  };

  const updateRes = (id: number, patch: Partial<ResourceRow>) =>
    setResources(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const setEffort = useCallback((rowId: number, weekNum: number, raw: string) => {
    const parsed = parseFloat(raw);
    const val = isNaN(parsed) ? 0 : round1(Math.min(5, Math.max(0, parsed)));
    setEfforts(prev => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [weekNum]: val } }));
    setConfirmed(false);
    onUnconfirm();
  }, [onUnconfirm]);

  const getRowTotal = (id: number) =>
    round1(Object.values(efforts[id] || {}).reduce((s, v) => s + v, 0));

  // Week-level totals across all resources (for footer row)
  const weekTotals = useMemo(() => {
    const t: Record<number, number> = {};
    for (const w of weeks) {
      t[w.weekNum] = round1(resources.reduce((s, r) => s + ((efforts[r.id] || {})[w.weekNum] || 0), 0));
    }
    return t;
  }, [weeks, resources, efforts]);

  const grandTotalAll = useMemo(() =>
    round1(Object.values(weekTotals).reduce((s, v) => s + v, 0)), [weekTotals]);

  // ── Pivot rows ────────────────────────────────────────────────────────────

  const pivotRows = useMemo(
    () => locFilter === "All" ? resources : resources.filter(r => r.location === locFilter),
    [resources, locFilter]
  );

  // phasePivot[phaseName][level] = total days
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
        if (d && p[w.phaseName]) p[w.phaseName][res.level] = round1((p[w.phaseName][res.level] || 0) + d);
      }
    }
    return p;
  }, [pivotRows, efforts, weeks, plan.phases]);

  // Year×Level pivot (Level rows already — just flip phase pivot is all that changed)
  const { yearPivot, years } = useMemo(() => {
    const ys = [...new Set(weeks.map(w => w.year))].sort();
    const yp: Record<number, Record<Level, number>> = {};
    for (const y of ys) { yp[y] = {} as Record<Level, number>; for (const lv of LEVELS) yp[y][lv] = 0; }
    for (const res of pivotRows) {
      const re = efforts[res.id] || {};
      for (const w of weeks) {
        const d = re[w.weekNum] || 0;
        if (d) yp[w.year][res.level] = round1((yp[w.year][res.level] || 0) + d);
      }
    }
    return { yearPivot: yp, years: ys };
  }, [pivotRows, efforts, weeks]);

  // Aggregation helpers (pivot 1: Level rows, Phase cols)
  const levelPhaseTot  = (lv: Level)                  => round1(plan.phases.reduce((s, p) => s + (phasePivot[p.name]?.[lv] || 0), 0));
  const phaseColTot    = (ph: string)                 => round1(LEVELS.reduce((s, l) => s + (phasePivot[ph]?.[l] || 0), 0));
  const grandPhaseTot  = ()                           => round1(LEVELS.reduce((s, l) => s + levelPhaseTot(l), 0));
  // Pivot 2: Year×Level
  const yearLvTot      = (y: number)                  => round1(LEVELS.reduce((s, l) => s + (yearPivot[y]?.[l] || 0), 0));
  const lvAllYrTot     = (lv: Level)                  => round1(years.reduce((s, y) => s + (yearPivot[y]?.[lv] || 0), 0));
  const grandYrTot     = ()                           => round1(years.reduce((s, y) => s + yearLvTot(y), 0));

  const hasEfforts = grandTotalAll > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 min-w-0 overflow-x-hidden">

      {/* ── Gantt ─────────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm" style={{ maxWidth: "100%" }}>
        <div className="px-5 py-3 border-b border-border bg-card">
          <p className="font-bold text-sm text-foreground">Resource Effort Gantt</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Enter days per week (max 5, 1 decimal). Use <strong>+</strong> to insert a row below; resource columns are frozen.
          </p>
        </div>

        {/* Scrollable area — does NOT affect page width */}
        <div className="overflow-x-auto">
          <table className="border-collapse text-xs"
            style={{ minWidth: `${FROZEN + weeks.length * WK_W + TOT_W}px` }}>

            <thead>
              {/* Row 1 — frozen header + phase bands */}
              <tr>
                {/* Frozen: actions + role + loc + level + remarks */}
                <th colSpan={5}
                  style={{ width: FROZEN, minWidth: FROZEN,
                           position: "sticky", left: 0, zIndex: 30,
                           backgroundColor: DARK, color: "#fff" }}
                  className="text-left px-3 py-2 text-[11px] font-bold border-r-2 border-[#333]">
                  Resource
                </th>
                {/* Phase bands */}
                {phaseGroups.map((g, gi) => (
                  <th key={gi} colSpan={g.count}
                    style={{ backgroundColor: g.hdr, color: "#fff", width: g.count * WK_W }}
                    className="text-center py-1.5 px-1 text-[10px] font-semibold border-r border-white/20 whitespace-nowrap">
                    {g.name}
                  </th>
                ))}
                <th style={{ backgroundColor: DARK, color: "#fff", width: TOT_W }}
                  className="text-center px-1 py-2 text-[11px] font-bold" />
              </tr>

              {/* Row 2 — column labels */}
              <tr>
                {/* Actions */}
                <th style={{ width: ACT_W, minWidth: ACT_W,
                             position: "sticky", left: 0, zIndex: 30,
                             backgroundColor: DARK, color: "#fff" }}
                  className="px-1 py-1.5 text-[10px] border-r border-[#333]" />
                {/* Role */}
                <th style={{ width: ROLE_W, minWidth: ROLE_W,
                             position: "sticky", left: ACT_W, zIndex: 30,
                             backgroundColor: DARK, color: "#fff" }}
                  className="text-left px-2 py-1.5 text-[10px] font-semibold border-r border-[#333]">Role</th>
                {/* Location */}
                <th style={{ width: LOC_W, minWidth: LOC_W,
                             position: "sticky", left: ACT_W + ROLE_W, zIndex: 30,
                             backgroundColor: DARK, color: "#fff" }}
                  className="text-center px-1 py-1.5 text-[10px] font-semibold border-r border-[#333]">Location</th>
                {/* Level */}
                <th style={{ width: LEV_W, minWidth: LEV_W,
                             position: "sticky", left: ACT_W + ROLE_W + LOC_W, zIndex: 30,
                             backgroundColor: DARK, color: "#fff" }}
                  className="text-center px-1 py-1.5 text-[10px] font-semibold border-r border-[#333]">Level</th>
                {/* Remarks */}
                <th style={{ width: REM_W, minWidth: REM_W,
                             position: "sticky", left: ACT_W + ROLE_W + LOC_W + LEV_W, zIndex: 30,
                             backgroundColor: DARK, color: "#fff" }}
                  className="text-left px-2 py-1.5 text-[10px] font-semibold border-r-2 border-[#444]">Remarks</th>
                {/* Week headers */}
                {weeks.map(w => (
                  <th key={w.weekNum}
                    style={{ width: WK_W, minWidth: WK_W,
                             backgroundColor: `${w.phaseHdr}28`, color: "#374151" }}
                    className="text-center py-1 border-r border-border">
                    <div className="text-[10px] font-bold leading-tight">W{w.weekNum}</div>
                    <div className="text-[8px] text-muted-foreground leading-none">
                      {format(w.startDate, "d MMM")}
                    </div>
                    <div className="text-[8px] text-muted-foreground leading-none">
                      {format(w.startDate, "yyyy")}
                    </div>
                  </th>
                ))}
                {/* Total header */}
                <th style={{ width: TOT_W, backgroundColor: DARK, color: "#fff" }}
                  className="text-center px-1 py-1.5 text-[10px] font-semibold">Total</th>
              </tr>
            </thead>

            <tbody>
              {resources.map((res, ri) => {
                const rowBg = ri % 2 === 0 ? "#FFFFFF" : "#F9FAFB";
                const total = getRowTotal(res.id);
                return (
                  <tr key={res.id} style={{ backgroundColor: rowBg }}>

                    {/* Actions — LEFT side */}
                    <td style={{ width: ACT_W, minWidth: ACT_W,
                                 position: "sticky", left: 0, zIndex: 10, backgroundColor: rowBg }}
                      className="border-r border-[#E5E7EB] px-1 py-1">
                      <div className="flex flex-col items-center gap-0.5">
                        <button title="Insert empty row below" onClick={() => insertRowAfter(res.id)}
                          className="w-5 h-5 flex items-center justify-center rounded bg-primary/10 text-primary hover:bg-primary/25 transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button title="Copy row (duplicate with efforts)" onClick={() => duplicateRow(res.id)}
                          className="w-5 h-5 flex items-center justify-center rounded bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-700 transition-colors">
                          <Copy className="w-3 h-3" />
                        </button>
                        <button title="Delete row" onClick={() => removeRow(res.id)}
                          className="w-5 h-5 flex items-center justify-center rounded bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Role */}
                    <td style={{ width: ROLE_W, minWidth: ROLE_W,
                                 position: "sticky", left: ACT_W, zIndex: 10, backgroundColor: rowBg }}
                      className="border-r border-[#E5E7EB] px-2 py-1">
                      <input value={res.role}
                        onChange={e => updateRes(res.id, { role: e.target.value })}
                        className="w-full bg-transparent text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 py-0.5" />
                    </td>

                    {/* Location */}
                    <td style={{ width: LOC_W, minWidth: LOC_W,
                                 position: "sticky", left: ACT_W + ROLE_W, zIndex: 10, backgroundColor: rowBg }}
                      className="border-r border-[#E5E7EB] px-1 py-1 text-center">
                      <select value={res.location}
                        onChange={e => updateRes(res.id, { location: e.target.value as Loc })}
                        className="w-full bg-transparent text-[10px] text-foreground focus:outline-none cursor-pointer text-center appearance-none">
                        <option>Onsite</option>
                        <option>Offshore</option>
                      </select>
                    </td>

                    {/* Level */}
                    <td style={{ width: LEV_W, minWidth: LEV_W,
                                 position: "sticky", left: ACT_W + ROLE_W + LOC_W, zIndex: 10, backgroundColor: rowBg }}
                      className="border-r border-[#E5E7EB] px-1 py-1 text-center">
                      <select value={res.level}
                        onChange={e => updateRes(res.id, { level: e.target.value as Level })}
                        className="w-full bg-transparent text-[10px] text-foreground focus:outline-none cursor-pointer appearance-none text-center">
                        {LEVELS.map(l => <option key={l}>{l}</option>)}
                      </select>
                    </td>

                    {/* Remarks */}
                    <td style={{ width: REM_W, minWidth: REM_W,
                                 position: "sticky", left: ACT_W + ROLE_W + LOC_W + LEV_W, zIndex: 10, backgroundColor: rowBg }}
                      className="border-r-2 border-[#D1D5DB] px-2 py-1">
                      <input value={res.remarks}
                        onChange={e => updateRes(res.id, { remarks: e.target.value })}
                        placeholder="Note…"
                        className="w-full bg-transparent text-[10px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 rounded px-1 py-0.5" />
                    </td>

                    {/* Week effort cells */}
                    {weeks.map(w => {
                      const val = (efforts[res.id] || {})[w.weekNum] || 0;
                      return (
                        <td key={w.weekNum}
                          style={{ width: WK_W, minWidth: WK_W,
                                   backgroundColor: val > 0 ? `${w.phaseHdr}22` : rowBg }}
                          className="border-r border-border px-0.5 py-0.5 text-center">
                          <input
                            type="number" min={0} max={5} step="any"
                            value={val || ""}
                            placeholder="·"
                            onChange={e => setEffort(res.id, w.weekNum, e.target.value)}
                            className="effort-input w-[42px] h-[22px] text-center text-xs font-mono rounded focus:outline-none focus:ring-1 focus:ring-primary/50 bg-transparent placeholder:text-muted-foreground/25 tabular-nums" />
                        </td>
                      );
                    })}

                    {/* Row total */}
                    <td style={{ width: TOT_W, color: total > 0 ? "#15803D" : "#9CA3AF" }}
                      className="text-center px-1 py-1 font-bold text-xs tabular-nums border-l-2 border-border">
                      {total || "-"}
                    </td>
                  </tr>
                );
              })}

              {/* ── Total footer row ─────────────────────────────────────── */}
              <tr style={{ backgroundColor: DARK }}>
                {/* Frozen total label */}
                <td colSpan={5}
                  style={{ position: "sticky", left: 0, zIndex: 10, backgroundColor: DARK, color: "#fff" }}
                  className="px-3 py-2 font-bold text-[11px] border-r-2 border-[#444]">
                  TOTAL DAYS
                </td>
                {/* Per-week totals */}
                {weeks.map(w => (
                  <td key={w.weekNum}
                    style={{ width: WK_W, color: (weekTotals[w.weekNum] || 0) > 0 ? GOLD : "#6B7280" }}
                    className="text-center px-0.5 py-2 font-bold text-xs tabular-nums border-r border-[#333]">
                    {weekTotals[w.weekNum] || "-"}
                  </td>
                ))}
                {/* Grand total */}
                <td style={{ width: TOT_W, color: GOLD }}
                  className="text-center px-1 py-2 font-bold text-sm tabular-nums border-l-2 border-[#444]">
                  {grandTotalAll || "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pivot section ─────────────────────────────────────────────────── */}
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

          {/* Pivot 1 — Level (rows) × Phase (cols) */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5" style={{ backgroundColor: DARK }}>
              <p className="text-xs font-bold text-white">Effort by Level &amp; Phase (days)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="text-left px-3 py-2 font-bold text-foreground border-b border-border whitespace-nowrap">Level</th>
                    {plan.phases.map(ph => {
                      const pal = PHASE_PALETTE[ph.name] || DEFAULT_PAL;
                      return (
                        <th key={ph.name}
                          className="text-center px-2 py-2 font-bold border-b border-border whitespace-nowrap text-[10px]"
                          style={{ color: pal.text }}>
                          {ph.name}
                        </th>
                      );
                    })}
                    <th className="text-center px-2 py-2 font-bold text-primary border-b border-border">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {LEVELS.map((lv, li) => {
                    const rowTot = levelPhaseTot(lv);
                    return (
                      <tr key={lv} style={{ backgroundColor: li % 2 === 0 ? "#fff" : "#F9FAFB" }}>
                        <td className="px-3 py-2 font-semibold text-foreground whitespace-nowrap">{lv}</td>
                        {plan.phases.map(ph => {
                          const v = phasePivot[ph.name]?.[lv] || 0;
                          return (
                            <td key={ph.name} className="text-center px-2 py-2 tabular-nums"
                              style={{ color: v > 0 ? "#111827" : "#D1D5DB" }}>{v}</td>
                          );
                        })}
                        <td className="text-center px-2 py-2 font-bold tabular-nums"
                          style={{ color: rowTot > 0 ? "#15803D" : "#9CA3AF" }}>{rowTot}</td>
                      </tr>
                    );
                  })}
                  {/* Column totals */}
                  <tr style={{ backgroundColor: DARK, color: "#fff" }}>
                    <td className="px-3 py-2 font-bold text-[11px] whitespace-nowrap">TOTAL</td>
                    {plan.phases.map(ph => (
                      <td key={ph.name} className="text-center px-2 py-2 font-bold tabular-nums">{phaseColTot(ph.name)}</td>
                    ))}
                    <td className="text-center px-2 py-2 font-bold tabular-nums" style={{ color: GOLD }}>{grandPhaseTot()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Pivot 2 — Level (rows) × Year (cols) */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5" style={{ backgroundColor: DARK }}>
              <p className="text-xs font-bold text-white">Effort by Level &amp; Year (days)</p>
              <p className="text-[10px] text-white/50 mt-0.5">Years shown based on project duration</p>
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
                        {years.map(y => {
                          const v = yearPivot[y]?.[lv] || 0;
                          return (
                            <td key={y} className="text-center px-2 py-2 tabular-nums"
                              style={{ color: v > 0 ? "#111827" : "#D1D5DB" }}>{v}</td>
                          );
                        })}
                        <td className="text-center px-2 py-2 font-bold tabular-nums"
                          style={{ color: tot > 0 ? "#15803D" : "#9CA3AF" }}>{tot}</td>
                      </tr>
                    );
                  })}
                  {/* Column totals */}
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

      {/* ── Confirm + Disclaimer + Download ───────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        {!confirmed ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              When you are done filling efforts, confirm to proceed to download.
            </p>
            <button
              disabled={!hasEfforts}
              onClick={() => { setConfirmed(true); onConfirm(); }}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all",
                hasEfforts
                  ? "bg-primary text-primary-foreground shadow hover:opacity-90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}>
              <CheckCircle2 className="w-4 h-4" />
              Confirm Resource Efforts
            </button>
            {!hasEfforts && (
              <p className="text-center text-[11px] text-muted-foreground">Fill in at least one effort cell to enable confirmation.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Confirmed banner */}
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <p className="text-xs font-semibold">
                Confirmed — <span className="font-bold">{grandTotalAll} days</span> total across {plan.phases.length} phases.
              </p>
              <button onClick={() => { setConfirmed(false); onUnconfirm(); }}
                className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors shrink-0">
                Edit
              </button>
            </div>

            {/* Disclaimer checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
              />
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
                I agree to the{" "}
                <button type="button" onClick={onOpenDisclaimers} className="text-primary font-semibold hover:underline">
                  Disclaimers &amp; Terms of Use
                </button>
                {" "}- this plan is for internal pre-sales use only.
              </span>
            </label>

            {/* Download button */}
            <button
              onClick={onDownload}
              disabled={!agreedToTerms || isDownloading}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all shadow",
                agreedToTerms && !isDownloading
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}>
              {isDownloading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing Excel...</>
                : <><Download className="w-4 h-4" /> Download Excel Plan</>}
            </button>

            {/* Share prompt after download */}
            <AnimatePresence>
              {hasDownloaded && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-xs font-semibold text-foreground">Your plan is ready - share your experience!</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Found this useful? Share on social media and invite your colleagues to try it. Leave a comment - feedback helps improve the tool!
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={xShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-black text-white text-xs font-bold rounded-lg py-2.5 hover:bg-black/80 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L2.25 2.25h6.986l4.263 5.637L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
                      </svg>
                      Share on X
                    </a>
                    <a
                      href={linkedInShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-[#0A66C2] text-white text-xs font-bold rounded-lg py-2.5 hover:bg-[#0958a8] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                      Share on LinkedIn
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

    </div>
  );
}
