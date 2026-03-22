import { Router } from "express";
import { db, generationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "placeholder",
});

const ACTIVITIES: Record<string, Record<string, any[]>> = {
  greenfield: {
    discover: [
      { category: "Project Setup", activity: "Initial Scoping Workshop", description: "Define project objectives, scope, and business case for net-new S/4HANA implementation", workstream: "Project Management", effort: "High", responsible: "SAP Consultant", accountable: "Project Manager", consulted: "Business Sponsor", informed: "Stakeholders", milestone: false },
      { category: "Project Setup", activity: "Demo System Setup", description: "Provision and configure SAP S/4HANA demo environment for executive showcases", workstream: "Technical", effort: "Medium", responsible: "Basis Team", accountable: "Technical Lead", consulted: "SAP Consultant", informed: "Project Manager", milestone: false },
      { category: "Business Case", activity: "Business Case Development", description: "Develop TCO analysis, ROI projections and executive business case presentation", workstream: "Project Management", effort: "High", responsible: "SAP Consultant", accountable: "Business Sponsor", consulted: "Finance", informed: "Board", milestone: true },
    ],
    prepare: [
      { category: "Project Initiation", activity: "Project Kickoff", description: "Formal project kickoff with all stakeholders, charter sign-off and team mobilization", workstream: "Project Management", effort: "High", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Organization", milestone: true },
      { category: "Project Initiation", activity: "SAP Activate Methodology Setup", description: "Configure SAP Cloud ALM / Focused Build project, create work packages and task templates", workstream: "Project Management", effort: "Medium", responsible: "Project Manager", accountable: "SAP Consultant", consulted: "Team Leads", informed: "Stakeholders", milestone: false },
      { category: "Infrastructure", activity: "System Landscape Design", description: "Design DEV-QAS-PRD landscape architecture, sizing and network topology", workstream: "Technical", effort: "High", responsible: "Basis Team", accountable: "Technical Lead", consulted: "SAP Consultant", informed: "Project Manager", milestone: false },
      { category: "Infrastructure", activity: "System Provisioning", description: "Provision SAP S/4HANA systems (DEV, QAS, PRD) on cloud or on-premise", workstream: "Technical", effort: "High", responsible: "Basis Team", accountable: "Technical Lead", consulted: "IT Infrastructure", informed: "Project Manager", milestone: false },
      { category: "Standards", activity: "Project Standards & Governance", description: "Define coding standards, naming conventions, transport strategy and change management", workstream: "Project Management", effort: "Medium", responsible: "SAP Lead Consultant", accountable: "Project Manager", consulted: "Team Leads", informed: "All Teams", milestone: false },
    ],
    explore: [
      { category: "Fit-to-Standard", activity: "FTS Workshop — Finance (FI/CO)", description: "Conduct Fit-to-Standard workshops for Finance, Controlling, Asset Accounting modules", workstream: "Finance", effort: "Very High", responsible: "Finance Consultant", accountable: "Finance Lead", consulted: "CFO/Finance Team", informed: "Project Manager", milestone: false },
      { category: "Fit-to-Standard", activity: "FTS Workshop — Procurement (MM/SRM)", description: "Conduct Fit-to-Standard workshops for Materials Management and Procurement", workstream: "Procurement", effort: "High", responsible: "MM Consultant", accountable: "Procurement Lead", consulted: "Procurement Team", informed: "Project Manager", milestone: false },
      { category: "Fit-to-Standard", activity: "FTS Workshop — Sales (SD/O2C)", description: "Conduct Fit-to-Standard workshops for Sales, Billing and Order-to-Cash process", workstream: "Sales", effort: "High", responsible: "SD Consultant", accountable: "Sales Lead", consulted: "Sales Team", informed: "Project Manager", milestone: false },
      { category: "Fit-to-Standard", activity: "FTS Workshop — Manufacturing/Logistics", description: "Conduct Fit-to-Standard workshops for Production Planning, WM and Supply Chain", workstream: "Operations", effort: "High", responsible: "PP/WM Consultant", accountable: "Operations Lead", consulted: "Operations Team", informed: "Project Manager", milestone: false },
      { category: "Gap Analysis", activity: "Gap/Delta Document & Sign-off", description: "Consolidate all gaps from FTS workshops, classify and obtain business sign-off", workstream: "Project Management", effort: "High", responsible: "SAP Lead Consultant", accountable: "Business Sponsor", consulted: "All Stream Leads", informed: "Steering Committee", milestone: true },
      { category: "Design", activity: "Solution Architecture & Design Document", description: "Finalize technical architecture, integration design and extension strategy (BTP, APIs)", workstream: "Technical", effort: "High", responsible: "Solution Architect", accountable: "Technical Lead", consulted: "Stream Consultants", informed: "Project Manager", milestone: false },
      { category: "Data", activity: "Data Migration Strategy & Template Design", description: "Define data migration approach, source mapping, cleansing rules and load sequence", workstream: "Data Management", effort: "High", responsible: "Data Lead", accountable: "Project Manager", consulted: "Business SMEs", informed: "Steering Committee", milestone: false },
    ],
    realizeDevelop: [
      { category: "Configuration", activity: "Enterprise Structure Configuration", description: "Configure company codes, plants, sales organizations, purchasing organizations and global settings", workstream: "Cross-Stream", effort: "High", responsible: "SAP Lead Consultant", accountable: "Solution Architect", consulted: "All Streams", informed: "Project Manager", milestone: false },
      { category: "Configuration", activity: "Finance Configuration (FI/CO)", description: "Configure GL, AP, AR, AA, Cost Centers, Profit Centers and Controlling structures", workstream: "Finance", effort: "Very High", responsible: "Finance Consultant", accountable: "Finance Lead", consulted: "Finance SMEs", informed: "CFO", milestone: false },
      { category: "Configuration", activity: "Procurement Configuration (MM)", description: "Configure purchasing, inventory management, valuation, invoice verification and vendor management", workstream: "Procurement", effort: "High", responsible: "MM Consultant", accountable: "Procurement Lead", consulted: "Procurement SMEs", informed: "CPO", milestone: false },
      { category: "Configuration", activity: "Sales Configuration (SD)", description: "Configure order management, pricing, billing, credit management and customer master data", workstream: "Sales", effort: "High", responsible: "SD Consultant", accountable: "Sales Lead", consulted: "Sales SMEs", informed: "CSO", milestone: false },
      { category: "Development", activity: "Custom Development (ABAP/Fiori)", description: "Develop approved custom enhancements, Fiori apps, BAPIs and forms (based on gap analysis)", workstream: "Technical", effort: "Very High", responsible: "ABAP Team", accountable: "Technical Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
      { category: "Integration", activity: "Integration Development & Testing", description: "Build and test all middleware integrations (iDoc, RFC, REST APIs, BTP Integration Suite)", workstream: "Technical", effort: "Very High", responsible: "Integration Team", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
      { category: "Data", activity: "Data Migration — Mock Loads", description: "Execute mock data migration loads, validate data quality and fix mapping issues", workstream: "Data Management", effort: "High", responsible: "Data Lead", accountable: "Data Team", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Testing", activity: "Unit Testing & SIT", description: "Conduct Unit Testing and System Integration Testing across all process streams", workstream: "Quality Assurance", effort: "Very High", responsible: "QA Team + Consultants", accountable: "QA Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Change Management", activity: "Training Material Development", description: "Develop role-based training materials, quick reference guides and e-learning content", workstream: "Change Management", effort: "High", responsible: "Change Manager", accountable: "Business Sponsor", consulted: "Stream Consultants", informed: "All Users", milestone: false },
    ],
    realizeUat: [
      { category: "UAT", activity: "User Acceptance Testing (UAT)", description: "Execute formal UAT with business users across all process streams, document sign-off", workstream: "Quality Assurance", responsible: "Business Users + QA", accountable: "Business Sponsor", consulted: "Consultants", informed: "Steering Committee", milestone: true },
      { category: "Cutover", activity: "Cutover Planning and Rehearsal", description: "Finalize cutover plan, execute cutover rehearsals and validate go/no-go criteria", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Board", milestone: false },
      { category: "Training", activity: "End User Training Delivery", description: "Deliver role-based training to all end users, record attendance and assess competency", workstream: "Change Management", responsible: "Trainers + Key Users", accountable: "Change Manager", consulted: "Department Heads", informed: "All Users", milestone: false },
    ],
    deploy: [
      { category: "Cutover", activity: "Final Data Migration Load", description: "Execute final production data migration, validate completeness and data quality sign-off", workstream: "Data Management", responsible: "Data Lead", accountable: "Business Sponsor", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Go-Live", activity: "Go-Live Execution", description: "Execute system go-live, activate production system and complete technical cutover steps", workstream: "Technical", responsible: "Basis + Technical Lead", accountable: "Project Manager", consulted: "All Teams", informed: "Organization", milestone: true },
    ],
    run: [
      { category: "Hypercare", activity: "Hypercare Support", description: "Intensive post-go-live support with consultants on-site, incident management and fixes", workstream: "Support", responsible: "All Consultants", accountable: "Project Manager", consulted: "Business SMEs", informed: "Steering Committee", milestone: false },
      { category: "Optimization", activity: "Performance Monitoring and Tuning", description: "Monitor system performance, optimize batch jobs, reports and critical business processes", workstream: "Technical", responsible: "Technical Lead + Basis", accountable: "IT Manager", consulted: "Business Users", informed: "Project Manager", milestone: false },
      { category: "Knowledge Transfer", activity: "Knowledge Transfer to Internal Team", description: "Complete knowledge transfer documentation, handover to BAU support team", workstream: "Change Management", responsible: "Consultants", accountable: "Internal IT Lead", consulted: "Support Team", informed: "Management", milestone: true },
      { category: "Closure", activity: "Project Closure and Lessons Learned", description: "Formal project closure, benefits realization review and lessons learned documentation", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Board", milestone: true },
    ],
  },
  brownfield: {
    discover: [
      { category: "Assessment", activity: "Current System Assessment", description: "Assess existing SAP ECC landscape, custom code, interfaces and data volumes", workstream: "Technical", effort: "High", responsible: "Solution Architect", accountable: "Technical Lead", consulted: "Basis Team", informed: "Project Manager", milestone: false },
      { category: "Assessment", activity: "Readiness Check & Simplification List", description: "Run SAP Readiness Check, Simplification Item analysis and custom code impact assessment", workstream: "Technical", effort: "High", responsible: "SAP Consultant", accountable: "Technical Lead", consulted: "ABAP Team", informed: "Project Manager", milestone: true },
      { category: "Business Case", activity: "Business Case — System Conversion", description: "Develop ROI analysis for system conversion vs. new implementation approach", workstream: "Project Management", effort: "Medium", responsible: "SAP Consultant", accountable: "Business Sponsor", consulted: "Finance", informed: "Board", milestone: false },
    ],
    prepare: [
      { category: "Project Initiation", activity: "Project Kickoff & Charter", description: "Formal kickoff, team mobilization and project charter sign-off for system conversion", workstream: "Project Management", effort: "High", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Organization", milestone: true },
      { category: "Technical Setup", activity: "Conversion System Setup", description: "Set up technical conversion environment, install SUM tool and migration cockpit", workstream: "Technical", effort: "High", responsible: "Basis Team", accountable: "Technical Lead", consulted: "SAP Support", informed: "Project Manager", milestone: false },
      { category: "Custom Code", activity: "Custom Code Remediation Plan", description: "Plan remediation of custom ABAP objects based on Simplification Item analysis", workstream: "Technical", effort: "High", responsible: "ABAP Lead", accountable: "Technical Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
    ],
    explore: [
      { category: "Delta Design", activity: "Delta Design — Finance (FI/CO)", description: "Design S/4HANA delta changes for Finance: universal journal, asset accounting migration", workstream: "Finance", effort: "High", responsible: "Finance Consultant", accountable: "Finance Lead", consulted: "Finance Team", informed: "CFO", milestone: false },
      { category: "Delta Design", activity: "Delta Design — Logistics", description: "Design S/4HANA delta changes for MM, SD, PP including new table structures", workstream: "Operations", effort: "High", responsible: "Logistics Consultant", accountable: "Operations Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Process Review", activity: "Business Process Review & Optimization", description: "Review existing processes, identify opportunities to adopt standard S/4HANA best practices", workstream: "Cross-Stream", effort: "High", responsible: "SAP Lead Consultant", accountable: "Business Sponsor", consulted: "Process Owners", informed: "Steering Committee", milestone: false },
      { category: "Technical", activity: "Integration & Interface Impact Analysis", description: "Analyze impact on existing interfaces, identify modifications required for S/4HANA APIs", workstream: "Technical", effort: "High", responsible: "Integration Team", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
    ],
    realizeDevelop: [
      { category: "Conversion", activity: "Custom Code Remediation", description: "Fix custom ABAP programs, function modules and reports affected by S/4HANA simplifications", workstream: "Technical", responsible: "ABAP Team", accountable: "Technical Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
      { category: "Conversion", activity: "Trial Conversion Runs", description: "Execute multiple trial system conversions (SUM), measure downtime and validate technical migration", workstream: "Technical", responsible: "Basis Team", accountable: "Technical Lead", consulted: "ABAP Team", informed: "Project Manager", milestone: false },
      { category: "Configuration", activity: "S/4HANA Delta Configuration", description: "Apply S/4HANA specific configurations, activate new functionality and business functions", workstream: "Cross-Stream", responsible: "Functional Consultants", accountable: "Solution Architect", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Integration", activity: "Interface Adaptation and Testing", description: "Adapt existing interfaces to S/4HANA APIs, test all inbound and outbound integrations", workstream: "Technical", responsible: "Integration Team", accountable: "Technical Lead", consulted: "External Teams", informed: "Project Manager", milestone: false },
      { category: "Testing", activity: "Regression Testing", description: "Execute comprehensive regression testing to ensure existing functionality is preserved", workstream: "Quality Assurance", responsible: "QA Team + Business", accountable: "QA Lead", consulted: "All Streams", informed: "Project Manager", milestone: false },
    ],
    realizeUat: [
      { category: "UAT", activity: "User Acceptance Testing", description: "Business-led UAT focusing on converted processes and new S/4HANA capabilities", workstream: "Quality Assurance", responsible: "Business Users", accountable: "Business Sponsor", consulted: "Consultants", informed: "Steering Committee", milestone: true },
      { category: "Training", activity: "End User Training Delivery", description: "Deliver role-based training for changed and new processes in S/4HANA", workstream: "Change Management", responsible: "Trainers + Key Users", accountable: "Change Manager", consulted: "Department Heads", informed: "All Users", milestone: false },
      { category: "Cutover", activity: "Cutover Planning and Rehearsal", description: "Finalize cutover plan for system conversion, execute rehearsals and validate go/no-go criteria", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Board", milestone: false },
    ],
    deploy: [
      { category: "Cutover", activity: "Cutover Execution - System Conversion", description: "Execute production system conversion using SUM, validate data post-conversion", workstream: "Technical", responsible: "Basis + Technical Lead", accountable: "Project Manager", consulted: "All Teams", informed: "Organization", milestone: true },
      { category: "Validation", activity: "Post-Conversion Data Validation", description: "Validate business data integrity, balances and open items after conversion", workstream: "Finance + Operations", responsible: "Business SMEs", accountable: "Business Sponsor", consulted: "Consultants", informed: "Project Manager", milestone: false },
    ],
    run: [
      { category: "Hypercare", activity: "Hypercare Support", description: "Intensive post-conversion support, rapid incident resolution and process stabilization", workstream: "Support", responsible: "All Consultants", accountable: "Project Manager", consulted: "Business SMEs", informed: "Steering Committee", milestone: false },
      { category: "Optimization", activity: "Performance and Process Optimization", description: "Optimize converted system performance, clean up legacy customizations no longer needed", workstream: "Technical", responsible: "Technical Lead", accountable: "IT Manager", consulted: "Business Users", informed: "Project Manager", milestone: false },
      { category: "Closure", activity: "Project Closure", description: "Formal project closure, benefits realization tracking and knowledge transfer completion", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Board", milestone: true },
    ],
  },
  bluefield: {
    discover: [
      { category: "Assessment", activity: "Selective Migration Assessment", description: "Assess which data objects, business processes and org structures to selectively migrate", workstream: "Project Management", effort: "High", responsible: "Solution Architect", accountable: "Business Sponsor", consulted: "Business SMEs", informed: "Board", milestone: false },
      { category: "Strategy", activity: "Bluefield Migration Strategy", description: "Define selective data extraction, transformation and load strategy for chosen business entities", workstream: "Technical", effort: "High", responsible: "Data Lead", accountable: "Technical Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: true },
    ],
    prepare: [
      { category: "Project Initiation", activity: "Project Kickoff & Governance", description: "Formal kickoff, team mobilization and governance model for selective migration project", workstream: "Project Management", effort: "High", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Organization", milestone: true },
      { category: "Technical Setup", activity: "Shell Conversion — Greenfield Configuration", description: "Perform shell conversion of existing system, configure new org structures and master data", workstream: "Technical", effort: "Very High", responsible: "Basis + Functional Team", accountable: "Technical Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Tools", activity: "Migration Tooling Setup (SNP / Magnitude)", description: "Set up and configure selective data migration tool (SNP, Magnitude or equivalent)", workstream: "Technical", effort: "High", responsible: "Data Team", accountable: "Technical Lead", consulted: "Tool Vendor", informed: "Project Manager", milestone: false },
    ],
    explore: [
      { category: "Design", activity: "Process Design — New vs Retained", description: "Design which processes follow Greenfield (new) vs retained Brownfield approach", workstream: "Cross-Stream", effort: "Very High", responsible: "SAP Lead Consultant", accountable: "Business Sponsor", consulted: "Process Owners", informed: "Steering Committee", milestone: true },
      { category: "Data Design", activity: "Data Object Scope & Migration Design", description: "Define data object scope, extraction rules, cleansing criteria and target mapping for selective load", workstream: "Data Management", effort: "Very High", responsible: "Data Lead", accountable: "Solution Architect", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "FTS", activity: "Fit-to-Standard for New Processes", description: "FTS workshops for newly adopted S/4HANA standard processes (replacing legacy customizations)", workstream: "Cross-Stream", effort: "High", responsible: "Functional Consultants", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
    ],
    realizeDevelop: [
      { category: "Configuration", activity: "S/4HANA Configuration (Greenfield Areas)", description: "Configure new org structures, master data and processes in clean S/4HANA environment", workstream: "Cross-Stream", responsible: "Functional Consultants", accountable: "Solution Architect", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Migration", activity: "Selective Data Migration Development", description: "Develop selective data extraction, transformation and load programs for all migration objects", workstream: "Data Management", responsible: "Data Team", accountable: "Data Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
      { category: "Migration", activity: "Migration Mock Loads and Validation", description: "Execute multiple data migration mock runs, validate balances, open items and data completeness", workstream: "Data Management", responsible: "Data Team + Business", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Development", activity: "Custom Development and Interface Build", description: "Develop approved ABAP enhancements, Fiori apps and updated interface adapters", workstream: "Technical", responsible: "ABAP + Integration Team", accountable: "Technical Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
      { category: "Testing", activity: "System Integration Testing", description: "End-to-end SIT covering all business scenarios across migrated and new configuration", workstream: "Quality Assurance", responsible: "QA Team + Consultants", accountable: "QA Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
    ],
    realizeUat: [
      { category: "UAT", activity: "User Acceptance Testing", description: "Business-led UAT covering both migrated historical processes and new S/4HANA capabilities", workstream: "Quality Assurance", responsible: "Business Users", accountable: "Business Sponsor", consulted: "Consultants", informed: "Steering Committee", milestone: true },
      { category: "Training", activity: "End User Training Delivery", description: "Train users on both new standard processes and migrated data handling procedures", workstream: "Change Management", responsible: "Trainers + Key Users", accountable: "Change Manager", consulted: "Department Heads", informed: "All Users", milestone: false },
      { category: "Cutover", activity: "Cutover Planning and Rehearsal", description: "Finalize cutover plan for selective migration go-live, execute rehearsals and validate criteria", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Board", milestone: false },
    ],
    deploy: [
      { category: "Migration", activity: "Final Selective Migration Execution", description: "Execute final production selective data migration, validate completeness and accuracy", workstream: "Data Management", responsible: "Data Lead", accountable: "Business Sponsor", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Go-Live", activity: "Go-Live and Cutover", description: "System go-live execution, cutover sign-off and activation of production environment", workstream: "Technical", responsible: "All Teams", accountable: "Project Manager", consulted: "Business Sponsor", informed: "Organization", milestone: true },
    ],
    run: [
      { category: "Hypercare", activity: "Hypercare Support", description: "Post-go-live intensive support for both migrated data validation and new process adoption", workstream: "Support", responsible: "All Consultants", accountable: "Project Manager", consulted: "Business SMEs", informed: "Steering Committee", milestone: false },
      { category: "Stabilization", activity: "Data Quality Validation and Remediation", description: "Validate migrated data quality in production, remediate any migration gaps found", workstream: "Data Management", responsible: "Data Lead + Business", accountable: "Business Sponsor", consulted: "All Teams", informed: "Project Manager", milestone: false },
      { category: "Closure", activity: "Project Closure and Benefits Review", description: "Formal closure, benefits realization review comparing selective migration approach value", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Board", milestone: true },
    ],
  },
};

function buildPlan(params: any) {
  const { transitionPath, projectStartDate, phases } = params;
  const acts = ACTIVITIES[transitionPath];
  const start = new Date(projectStartDate);
  
  const phaseList = [
    phases.discover?.included ? { key: "discover", name: "Discover", weeks: phases.discover.weeks } : null,
    { key: "prepare", name: "Prepare", weeks: phases.prepare.weeks },
    { key: "explore", name: "Explore", weeks: phases.explore.weeks },
    { key: "realizeDevelop", name: "Realize - Develop", weeks: phases.realizeDevelop.weeks },
    { key: "realizeUat", name: "Realize - UAT", weeks: phases.realizeUat?.weeks || 6 },
    { key: "deploy", name: "Deploy", weeks: phases.deploy.weeks },
    { key: "run", name: "Run", weeks: phases.run.weeks },
  ].filter(Boolean);

  let weekOffset = 0;
  const planPhases = phaseList.map((phase: any) => {
    const phaseStart = new Date(start.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000);
    const phaseEnd = new Date(phaseStart.getTime() + (phase.weeks - 1) * 7 * 24 * 60 * 60 * 1000 + 6 * 24 * 60 * 60 * 1000);
    
    const activities = (acts[phase.key] || []).map((act: any, idx: number) => ({
      ...act,
      startWeek: weekOffset + 1 + Math.floor(idx * phase.weeks / Math.max(acts[phase.key].length, 1)),
      endWeek: weekOffset + Math.min(phase.weeks, Math.ceil((idx + 1) * phase.weeks / Math.max(acts[phase.key].length, 1))),
      duration: `${Math.ceil(phase.weeks / Math.max(acts[phase.key].length, 1))} weeks`,
    }));

    weekOffset += phase.weeks;
    return {
      name: phase.name,
      startDate: phaseStart.toISOString().split("T")[0],
      endDate: phaseEnd.toISOString().split("T")[0],
      weeks: phase.weeks,
      activities,
    };
  });

  const totalWeeks = phaseList.reduce((s: number, p: any) => s + p.weeks, 0);
  return {
    title: `3B Michimap - ${transitionPath.charAt(0).toUpperCase() + transitionPath.slice(1)} SAP S/4HANA Project Plan`,
    transitionPath,
    projectStartDate,
    phases: planPhases,
    totalWeeks,
    summary: `${transitionPath.charAt(0).toUpperCase() + transitionPath.slice(1)} implementation over ${totalWeeks} weeks (~${Math.round(totalWeeks / 4.3)} months). Includes ${planPhases.length} SAP Activate phases.`,
  };
}

async function generateWithAI(params: any): Promise<any> {
  const plan = buildPlan(params);
  
  // Enhance activities with AI
  try {
    const apiKey = params.apiKey;
    let client = openai;
    
    if (apiKey && params.aiModel && params.aiModel !== "gpt-5.2") {
      // Use user's own API key for paid models
      client = new OpenAI({ apiKey });
    }

    const prompt = `You are an SAP S/4HANA implementation expert. The user has selected a ${params.transitionPath} transition path with ${params.phases.realizeDevelop.weeks} weeks for Realize-Develop.

Based on this, provide a brief executive summary (2-3 sentences) for this project plan. Keep it professional and specific to ${params.transitionPath} implementation.

Return ONLY a JSON object with one field: {"summary": "your summary here"}`;

    const response = await client.chat.completions.create({
      model: "gpt-5.2",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 200,
    });

    const content = response.choices[0]?.message?.content || "";
    try {
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
      if (parsed.summary) plan.summary = parsed.summary;
    } catch {}
  } catch (err) {
    logger.warn({ err }, "AI enhancement failed, using default summary");
  }

  return plan;
}

// In-memory plan store (in production this would be in DB)
const planStore = new Map<string, any>();

router.post("/plan", async (req, res) => {
  try {
    const { aiModel, apiKey, transitionPath, projectStartDate, phases } = req.body;
    
    if (!transitionPath || !projectStartDate || !phases) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const plan = await generateWithAI({ aiModel, apiKey, transitionPath, projectStartDate, phases });
    
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    // Track generation in DB (best-effort)
    const user = req.isAuthenticated() ? req.user : null;
    const realizeUatWeeks = phases.realizeUat?.weeks || 6;
    const totalWeeks = (phases.discover?.included ? phases.discover.weeks : 0) +
      phases.prepare.weeks + phases.explore.weeks + phases.realizeDevelop.weeks +
      realizeUatWeeks + phases.deploy.weeks + phases.run.weeks;

    let generationId: number | null = null;
    try {
      const inserted = await db.insert(generationsTable).values({
        userId: user?.id || null,
        transitionPath,
        aiModel,
        projectStartDate,
        totalWeeks,
        planData: plan,
        downloaded: false,
      }).returning({ id: generationsTable.id });
      generationId = inserted[0]?.id || null;
    } catch (dbErr) {
      logger.warn({ dbErr }, "Failed to save generation to DB");
    }

    planStore.set(planId, { ...plan, requestBody: req.body, generationId });

    res.json({ success: true, planId, plan });
  } catch (err) {
    logger.error({ err }, "Generate plan error");
    res.status(500).json({ error: "Failed to generate plan" });
  }
});

router.post("/download", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });
  const user = req.user;

  const { planId } = req.body;
  if (!planId) return res.status(400).json({ error: "planId required" });

  const plan = planStore.get(planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  try {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "3B Michimap";
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet("Summary", {
      pageSetup: { orientation: "landscape", fitToPage: true }
    });
    summarySheet.columns = [
      { width: 30 }, { width: 50 }, { width: 20 }, { width: 20 }
    ];
    
    summarySheet.mergeCells("A1:D1");
    const titleCell = summarySheet.getCell("A1");
    titleCell.value = "3B Michimap - SAP S/4HANA Project Plan";
    titleCell.font = { bold: true, size: 16, color: { argb: "FF1A1A1A" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F0E8" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    summarySheet.getRow(1).height = 35;

    summarySheet.mergeCells("A2:D2");
    const subtitleCell = summarySheet.getCell("A2");
    subtitleCell.value = `Generated by 3B Michimap | ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;
    subtitleCell.font = { italic: true, size: 10, color: { argb: "FF888888" } };
    subtitleCell.alignment = { horizontal: "center" };
    summarySheet.getRow(2).height = 20;

    const infoRows = [
      ["", ""],
      ["Transition Path", plan.transitionPath.charAt(0).toUpperCase() + plan.transitionPath.slice(1)],
      ["Project Start Date", plan.projectStartDate],
      ["Total Duration", `${plan.totalWeeks} weeks (~${Math.round(plan.totalWeeks / 4.3)} months)`],
      ["AI Model Used", plan.requestBody?.aiModel || "GPT-5.2"],
      ["Generated On", new Date().toLocaleDateString("en-GB")],
      ["", ""],
      ["Executive Summary", plan.summary || ""],
    ];
    infoRows.forEach(([label, value]) => {
      const row = summarySheet.addRow([label, value]);
      if (label) {
        row.getCell(1).font = { bold: true };
        row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E7" } };
      }
    });

    // Disclaimer sheet
    const disclaimerSheet = workbook.addWorksheet("Disclaimers");
    disclaimerSheet.columns = [{ width: 20 }, { width: 100 }];
    disclaimerSheet.addRow(["DISCLAIMERS & TERMS OF USE"]).getCell(1).font = { bold: true, size: 12 };
    disclaimerSheet.addRow([]);
    const disclaimers = [
      ["1. Accuracy / No Warranty", "Effort estimates are indicative and based on inputs provided by the user. 3B Michimap makes no warranty, express or implied, regarding the accuracy, completeness, or fitness of generated outputs for any specific engagement."],
      ["2. No Commercial Reliance", "Outputs from this tool are intended for internal planning purposes only and should not be submitted to clients or included in formal commercial proposals without independent validation by a qualified SAP professional."],
      ["3. Third-Party Login", "Authentication is facilitated via third-party providers (Google, LinkedIn). 3B Michimap is not responsible for data handling practices of these providers."],
      ["4. Acceptable Use", "This tool is intended exclusively for SAP pre-sales and delivery professionals. Unauthorised use, reverse engineering, or redistribution of generated outputs is prohibited."],
    ];
    disclaimers.forEach(([title, text]) => {
      const row = disclaimerSheet.addRow([title, text]);
      row.getCell(1).font = { bold: true };
      row.getCell(2).alignment = { wrapText: true };
      disclaimerSheet.addRow([]);
    });

    // Phase colors (background)
    const PHASE_COLORS: Record<string, string> = {
      "Discover": "FFDBEAFE",
      "Prepare": "FFD1FAE5",
      "Explore": "FFFED7AA",
      "Realize - Develop": "FFFEF3C7",
      "Realize - UAT": "FFFEE2E2",
      "Deploy": "FFE9D5FF",
      "Run": "FFCCFBF1",
    };
    const HEADER_COLOR = "FF1A1A1A";
    const HEADER_FONT_COLOR = "FFFFFFFF";

    // Main plan sheet per phase
    for (const phase of plan.phases) {
      const sheet = workbook.addWorksheet(phase.name, { pageSetup: { orientation: "landscape", fitToPage: true } });
      const bgColor = PHASE_COLORS[phase.name] || "FFFFFFFF";
      
      // Phase header
      sheet.mergeCells("A1:N1");
      const phaseHeader = sheet.getCell("A1");
      phaseHeader.value = `${phase.name.toUpperCase()} - ${phase.startDate} to ${phase.endDate} (${phase.weeks} weeks)`;
      phaseHeader.font = { bold: true, size: 13, color: { argb: HEADER_FONT_COLOR } };
      phaseHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_COLOR } };
      phaseHeader.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(1).height = 28;

      // Column headers
      const headers = ["Category", "Activity", "Description", "Workstream", "Responsible", "Accountable", "Consulted", "Informed", "Start Wk", "End Wk", "Duration", "Milestone"];
      const colWidths = [18, 30, 45, 18, 22, 22, 22, 22, 9, 9, 10, 10];
      sheet.columns = colWidths.map(w => ({ width: w }));

      const headerRow = sheet.addRow(headers);
      headerRow.eachCell(cell => {
        cell.font = { bold: true, size: 10, color: { argb: "FF1A1A1A" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCCCCCC" } },
          bottom: { style: "medium", color: { argb: "FFAAAAAA" } },
          right: { style: "thin", color: { argb: "FFCCCCCC" } },
        };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      });
      sheet.getRow(2).height = 22;

      // Data rows
      for (const act of phase.activities) {
        const dataRow = sheet.addRow([
          act.category,
          act.activity,
          act.description,
          act.workstream,
          act.responsible,
          act.accountable,
          act.consulted,
          act.informed,
          act.startWeek,
          act.endWeek,
          act.duration,
          act.milestone ? "Milestone" : "",
        ]);
        dataRow.eachCell((cell, colNum) => {
          cell.font = { size: 9 };
          cell.alignment = { vertical: "top", wrapText: colNum <= 4 };
          cell.border = {
            bottom: { style: "hair", color: { argb: "FFDDDDDD" } },
            right: { style: "hair", color: { argb: "FFDDDDDD" } },
          };
          if (act.milestone) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9C4" } };
          }
        });
        dataRow.getCell(13).font = { bold: act.milestone, size: 9, color: { argb: act.milestone ? "FFC8941A" : "FF666666" } };
        dataRow.height = 32;
      }
    }

    // Update download record if we have a generation ID stored
    const storedPlan = planStore.get(planId);
    if (storedPlan?.generationId) {
      await db.update(generationsTable)
        .set({ downloaded: true, downloadedAt: new Date() })
        .where(eq(generationsTable.id, storedPlan.generationId))
        .catch(() => {});
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="3B_Michimap_${plan.transitionPath}_${plan.projectStartDate}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    logger.error({ err }, "Download plan error");
    res.status(500).json({ error: "Failed to generate Excel file" });
  }
});

export default router;
