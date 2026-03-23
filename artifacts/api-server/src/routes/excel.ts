// @ts-nocheck
import { Router } from "express";
import ExcelJS from "exceljs";
import path from "path";

const router = Router();

const PHASE_COLORS: Record<string, { argb: string; fontArgb: string }> = {
  "Discover":        { argb: "FF3B82F6", fontArgb: "FFFFFFFF" },
  "Prepare":         { argb: "FF22C55E", fontArgb: "FFFFFFFF" },
  "Explore":         { argb: "FFF97316", fontArgb: "FFFFFFFF" },
  "Realize-Develop": { argb: "FFEAB308", fontArgb: "FF1A1A2E" },
  "Realize-UAT":     { argb: "FFEF4444", fontArgb: "FFFFFFFF" },
  "Deploy":          { argb: "FF14B8A6", fontArgb: "FFFFFFFF" },
  "Run":             { argb: "FFA855F4", fontArgb: "FFFFFFFF" },
};

const HEADER_ARGB = "FF1A1A2E";
const PRIMARY_ARGB = "FFE9A944";
const ALT_ROW_ARGB = "FFF8F9FA";

function borderThin() {
  return {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };
}

router.post("/generate-plan", async (req, res) => {
  const { projectName, projectStart, transitionPath, tasks } = req.body as {
    projectName: string;
    projectStart: string;
    transitionPath: string;
    tasks: Array<{
      id: number;
      name: string;
      phase: string;
      workstream: string;
      startDay: number;
      duration: number;
      assignedTo: string;
    }>;
  };

  if (!Array.isArray(tasks) || tasks.length === 0) {
    res.status(400).json({ error: "No tasks provided" });
    return;
  }

  const startDate = projectStart ? new Date(projectStart) : new Date();

  function dayToDate(day: number): Date {
    const d = new Date(startDate);
    d.setDate(d.getDate() + day - 1);
    return d;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "3B Michimap";
  wb.created = new Date();

  // ---- Sheet 1: Project Plan ----
  const ws = wb.addWorksheet("Project Plan", {
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
    views: [{ state: "frozen", ySplit: 2 }],
  });

  // Title row
  ws.mergeCells("A1:I1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `${projectName || "S/4HANA Project"} - Project Plan`;
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF1A1A2E" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_ARGB } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 36;

  // Metadata below title
  ws.mergeCells("A2:C2");
  ws.getCell("A2").value = `Transition: ${transitionPath || "Greenfield"}`;
  ws.getCell("A2").font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF64748B" } };
  ws.mergeCells("D2:F2");
  ws.getCell("D2").value = `Start Date: ${startDate.toDateString()}`;
  ws.getCell("D2").font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF64748B" } };
  ws.mergeCells("G2:I2");
  ws.getCell("G2").value = `Generated: ${new Date().toDateString()}`;
  ws.getCell("G2").font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF64748B" } };
  ws.getRow(2).height = 22;

  // Header row
  const headers = ["#", "Task Name", "Phase", "Workstream", "Assigned To", "Start Date", "End Date", "Duration (Days)", "Start Day"];
  const colWidths = [5, 45, 18, 22, 22, 16, 16, 18, 12];
  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell, colNum) => {
    cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_ARGB } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.border = borderThin();
    ws.getColumn(colNum).width = colWidths[colNum - 1] || 15;
  });

  // Data rows
  tasks.forEach((task, i) => {
    const startDt = dayToDate(task.startDay);
    const endDt = dayToDate(task.startDay + task.duration - 1);
    const phaseColor = PHASE_COLORS[task.phase] || PHASE_COLORS["Discover"];

    const row = ws.addRow([
      i + 1,
      task.name || "",
      task.phase || "",
      task.workstream || "",
      task.assignedTo || "",
      startDt,
      endDt,
      task.duration,
      task.startDay,
    ]);
    row.height = 22;

    // Format date columns
    ws.getColumn(6).numFmt = "dd-mmm-yyyy";
    ws.getColumn(7).numFmt = "dd-mmm-yyyy";

    const isAlt = i % 2 === 1;
    row.eachCell((cell, colNum) => {
      cell.border = borderThin();
      cell.font = { name: "Calibri", size: 11 };
      cell.alignment = { vertical: "middle", horizontal: colNum === 2 ? "left" : "center" };

      if (colNum === 3) {
        // Phase column: coloured badge
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: phaseColor.fontArgb } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: phaseColor.argb } };
      } else if (isAlt) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT_ROW_ARGB } };
      }
    });
  });

  // Auto-filter on header row
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 9 } };

  // ---- Sheet 2: Gantt ----
  const wg = wb.addWorksheet("Gantt Chart", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 3 }],
  });

  const totalDays = tasks.reduce((m, t) => Math.max(m, t.startDay + t.duration - 1), 0);
  const ganttDays = Math.min(totalDays + 5, 120);

  // Title
  wg.mergeCells(1, 1, 1, ganttDays + 2);
  const gTitle = wg.getCell("A1");
  gTitle.value = `${projectName || "Project"} - Gantt Chart`;
  gTitle.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF1A1A2E" } };
  gTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_ARGB } };
  gTitle.alignment = { vertical: "middle", horizontal: "left" };
  wg.getRow(1).height = 30;

  // Month header row
  const monthRow = wg.getRow(2);
  monthRow.height = 18;
  wg.getCell(2, 1).value = "Phase";
  wg.getCell(2, 2).value = "Task Name";
  wg.getCell(2, 1).font = { name: "Calibri", size: 10, bold: true };
  wg.getCell(2, 2).font = { name: "Calibri", size: 10, bold: true };

  for (let d = 1; d <= ganttDays; d++) {
    const dt = dayToDate(d);
    const cell = wg.getCell(2, d + 2);
    cell.value = dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    cell.font = { name: "Calibri", size: 8, color: { argb: "FF64748B" } };
    cell.alignment = { horizontal: "center", textRotation: 45 };
  }
  monthRow.height = 48;

  // Day number header
  const dayRow = wg.getRow(3);
  dayRow.height = 18;
  wg.getCell(3, 1).value = "Phase";
  wg.getCell(3, 2).value = "Task";
  [wg.getCell(3, 1), wg.getCell(3, 2)].forEach(c => {
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_ARGB } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
  for (let d = 1; d <= ganttDays; d++) {
    const cell = wg.getCell(3, d + 2);
    cell.value = d;
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_ARGB } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    wg.getColumn(d + 2).width = 4;
  }

  wg.getColumn(1).width = 18;
  wg.getColumn(2).width = 36;

  // Task rows
  tasks.forEach((task, i) => {
    const rowNum = i + 4;
    const phaseColor = PHASE_COLORS[task.phase] || PHASE_COLORS["Discover"];
    const gRow = wg.getRow(rowNum);
    gRow.height = 20;

    // Phase cell
    const phaseCell = wg.getCell(rowNum, 1);
    phaseCell.value = task.phase;
    phaseCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: phaseColor.fontArgb } };
    phaseCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: phaseColor.argb } };
    phaseCell.alignment = { vertical: "middle", horizontal: "center" };
    phaseCell.border = borderThin();

    // Task name cell
    const nameCell = wg.getCell(rowNum, 2);
    nameCell.value = task.name || "";
    nameCell.font = { name: "Calibri", size: 10 };
    nameCell.alignment = { vertical: "middle", horizontal: "left" };
    nameCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 1 ? ALT_ROW_ARGB : "FFFFFFFF" } };
    nameCell.border = borderThin();

    // Gantt bar cells
    for (let d = 1; d <= ganttDays; d++) {
      const cell = wg.getCell(rowNum, d + 2);
      const inRange = d >= task.startDay && d < task.startDay + task.duration;
      if (inRange) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: phaseColor.argb } };
        // Show assigned to on first cell of bar
        if (d === task.startDay && task.assignedTo) {
          cell.value = task.assignedTo;
          cell.font = { name: "Calibri", size: 7, bold: true, color: { argb: phaseColor.fontArgb } };
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      } else {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 1 ? ALT_ROW_ARGB : "FFFFFFFF" } };
      }
      cell.border = { right: { style: "hair", color: { argb: "FFE2E8F0" } }, bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
    }
  });

  // ---- Sheet 3: Summary ----
  const ws3 = wb.addWorksheet("Summary");
  ws3.getColumn(1).width = 22;
  ws3.getColumn(2).width = 18;

  ws3.mergeCells("A1:B1");
  ws3.getCell("A1").value = "Project Summary";
  ws3.getCell("A1").font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  ws3.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_ARGB } };
  ws3.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
  ws3.getRow(1).height = 32;

  const summaryData = [
    ["Project Name", projectName || ""],
    ["Transition Path", transitionPath || ""],
    ["Start Date", startDate.toDateString()],
    ["Total Tasks", tasks.length],
    ["Total Duration (Days)", totalDays],
    ["Phases Covered", [...new Set(tasks.map(t => t.phase))].join(", ")],
    ["Generated By", "3B Michimap"],
    ["Generated On", new Date().toDateString()],
  ];

  summaryData.forEach(([label, value], i) => {
    const row = ws3.addRow([label, value]);
    row.height = 22;
    const isAlt = i % 2 === 1;
    row.getCell(1).font = { name: "Calibri", size: 11, bold: true };
    row.getCell(2).font = { name: "Calibri", size: 11 };
    if (isAlt) {
      [row.getCell(1), row.getCell(2)].forEach(c => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT_ROW_ARGB } };
      });
    }
    [row.getCell(1), row.getCell(2)].forEach(c => { c.border = borderThin(); c.alignment = { vertical: "middle" }; });
  });

  // ---- Send response ----
  const safeName = (projectName || "Project").replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
  const filename = `${safeName}_Plan.xlsx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  await wb.xlsx.write(res);
  res.end();
});

export default router;
