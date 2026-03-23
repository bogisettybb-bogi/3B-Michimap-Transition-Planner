import { Router } from "express";
import { db, generationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendPlanEmail } from "../lib/email";
import OpenAI from "openai";
import { randomUUID } from "crypto";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "placeholder",
});

// Free models: all route through our server (Replit AI proxy)
const FREE_MODEL_MAP: Record<string, string> = {
  "gemini-2-5-flash": "gpt-5-mini",   // Gemini 2.5 Flash (default)
  "gemini-2-flash":   "gpt-5-mini",   // Gemini 2.0 Flash
  "gpt-4o-free":      "gpt-5-mini",   // GPT-4o
  "gpt-4o-mini":      "gpt-5-nano",   // GPT-4o mini
  "o4-mini":          "gpt-5-nano",   // o4-mini (reasoning)
  "gpt-5-mini":       "gpt-5-mini",   // GPT-5 mini
  "llama-3-3-70b":    "gpt-5-nano",   // Llama 3.3 70B
  "mixtral-8x7b":     "gpt-5-nano",   // Mixtral 8x7B
  "claude-3-5-haiku": "gpt-5-nano",   // Claude 3.5 Haiku
  "deepseek-v3":      "gpt-5-mini",   // DeepSeek-V3
};

// Paid models: user supplies their own API key
const PAID_MODEL_BASES: Record<string, { baseURL: string; model: string }> = {
  "gpt-4o":            { baseURL: "https://api.openai.com/v1",                              model: "gpt-4o" },
  "o1":                { baseURL: "https://api.openai.com/v1",                              model: "o1" },
  "claude-3-5-sonnet": { baseURL: "https://api.anthropic.com/v1",                           model: "claude-3-5-sonnet-20241022" },
  "claude-3-7-sonnet": { baseURL: "https://api.anthropic.com/v1",                           model: "claude-3-7-sonnet-20250219" },
  "gemini-2-5-flash":  { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash-preview-05-20" },
  "gemini-1-5-pro":    { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-1.5-pro" },
  "gemini-2-5-pro":    { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-pro-preview-05-06" },
  "deepseek-r1":       { baseURL: "https://api.deepseek.com/v1",                            model: "deepseek-reasoner" },
};

const ACTIVITIES: Record<string, Record<string, any[]>> = {
  greenfield: {
    discover: [
      { category: "Scoping", activity: "Initial Scoping and Objectives Workshop", description: "Define project objectives, business drivers, in-scope modules and high-level implementation approach for net-new S/4HANA", workstream: "Project Management", responsible: "SAP Consultant", accountable: "Business Sponsor", consulted: "Business Leads", informed: "Steering Committee", milestone: false },
      { category: "Business Case", activity: "Business Case and ROI Development", description: "Develop TCO analysis, ROI projections and executive business case presentation for net-new S/4HANA implementation", workstream: "Project Management", responsible: "SAP Consultant", accountable: "Business Sponsor", consulted: "Finance", informed: "Board", milestone: true },
      { category: "Demo", activity: "S/4HANA Demo and Value Discovery", description: "Conduct S/4HANA best practices demo to key stakeholders to validate scope and build buy-in", workstream: "Project Management", responsible: "SAP Consultant", accountable: "Business Sponsor", consulted: "Business Leads", informed: "Stakeholders", milestone: false },
    ],
    prepare: [
      { category: "Governance", activity: "Establish governance model, define RACI, and finalize detailed project plan with milestones and delivery model", description: "Approved execution plan", workstream: "Project Management", effortPct: "4%", notes: "Risk: unclear governance delays decisions", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Stream Leads", informed: "Steering Committee", milestone: true },
      { category: "Infrastructure", activity: "Provision S/4HANA system landscape (DEV, QAS, PRD) and configure transport routes using TMS", description: "Landscape ready", workstream: "Technical", effortPct: "4%", notes: "Tool: STMS", responsible: "Basis", accountable: "Technical Lead", consulted: "SAP Consultant", informed: "Project Manager", milestone: false },
      { category: "Infrastructure", activity: "Configure client settings, user roles, authorizations, and transport layers", description: "System baseline", workstream: "Technical", effortPct: "3%", notes: "TCode: SCC4, SU01, PFCG", responsible: "Basis", accountable: "Technical Lead", consulted: "IT Security", informed: "Project Manager", milestone: false },
      { category: "Data Management", activity: "Define data migration approach including object scoping, sequencing, and legacy system connectivity", description: "Migration strategy", workstream: "Data Management", effortPct: "4%", notes: "Tool: Migration Cockpit", responsible: "Technical Consultant", accountable: "Project Manager", consulted: "Business SMEs", informed: "Steering Committee", milestone: false },
      { category: "Integration", activity: "Define integration architecture including middleware selection and communication protocols", description: "Integration baseline", workstream: "Technical", effortPct: "3%", notes: "Tool: SAP Integration Suite", responsible: "Integration Consultant", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
    ],
    explore: [
      { category: "Fit-to-Standard", activity: "Conduct fit-to-standard workshops in DEV system using SAP Best Practices and capture delta requirements", description: "Gap list", workstream: "Cross-Stream", effortPct: "6%", notes: "Accelerator: SAP Best Practices", responsible: "Functional Consultant", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Configuration", activity: "Configure baseline business processes in DEV system to validate standard process fitment", description: "Validated flows", workstream: "Cross-Stream", effortPct: "5%", notes: "Risk: over-customization", responsible: "Functional Consultant", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Design", activity: "Finalize functional and technical design including WRICEF object identification and approvals", description: "Signed-off design", workstream: "Cross-Stream", effortPct: "5%", notes: "Risk: scope creep", responsible: "Functional + Technical", accountable: "Solution Architect", consulted: "Business SMEs", informed: "Project Manager", milestone: true },
      { category: "Data Management", activity: "Define data migration objects, mappings, and transformation logic", description: "Migration repository", workstream: "Data Management", effortPct: "4%", notes: "", responsible: "Technical Consultant", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Sign-off", activity: "Conduct design authority reviews and obtain formal customer sign-off on solution scope", description: "Design baseline locked", workstream: "Project Management", effortPct: "5%", notes: "Risk: sign-off delays", responsible: "Customer + PM", accountable: "Business Sponsor", consulted: "All Stream Leads", informed: "Steering Committee", milestone: true },
    ],
    realizeDevelop: [
      { category: "Configuration", activity: "Configure business processes in DEV using IMG and transport configurations to QAS", description: "Configured solution", workstream: "Cross-Stream", effortPct: "6%", notes: "TCode: SPRO", responsible: "Functional Consultant", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Development", activity: "Develop WRICEF objects in DEV and transport to QAS following transport management procedures", description: "Custom developments", workstream: "Technical", effortPct: "7%", notes: "", responsible: "Technical Consultant", accountable: "Technical Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
      { category: "Data Management", activity: "Execute data migration mock cycles into QAS using Migration Cockpit and validate results", description: "Validated data", workstream: "Data Management", effortPct: "6%", notes: "", responsible: "Technical Consultant", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Integration", activity: "Build and validate integration interfaces using middleware and APIs across systems", description: "Integrated system", workstream: "Technical", effortPct: "5%", notes: "", responsible: "Integration Consultant", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
      { category: "Testing", activity: "Execute unit testing in DEV and SIT in QAS including end-to-end validation scenarios", description: "Tested solution", workstream: "Quality Assurance", effortPct: "5%", notes: "", responsible: "All", accountable: "QA Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
    ],
    realizeUat: [
      { category: "UAT", activity: "Execute UAT cycles in QAS, manage defect resolution, and obtain formal customer sign-off", description: "UAT sign-off", workstream: "Quality Assurance", effortPct: "6%", notes: "Critical dependency", responsible: "Customer + Functional", accountable: "Business Sponsor", consulted: "Business Users", informed: "Steering Committee", milestone: true },
      { category: "Cutover", activity: "Finalize cutover plan, rehearse cutover execution, and validate go/no-go criteria with all teams", description: "Cutover readiness", workstream: "Project Management", effortPct: "2%", notes: "", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Board", milestone: false },
      { category: "Training", activity: "Deliver end-user training and confirm system access readiness for production go-live", description: "Users trained", workstream: "Change Management", effortPct: "2%", notes: "", responsible: "Functional Consultant", accountable: "Change Manager", consulted: "Department Heads", informed: "All Users", milestone: false },
    ],
    deploy: [
      { category: "Cutover", activity: "Execute cutover plan including transport movement from QAS to PRD and production readiness validation", description: "Go-live readiness", workstream: "Project Management", effortPct: "4%", notes: "", responsible: "PM + Basis", accountable: "Project Manager", consulted: "All Teams", informed: "Organization", milestone: false },
      { category: "Data Management", activity: "Perform final data migration into PRD system and execute reconciliation checks", description: "Production data ready", workstream: "Data Management", effortPct: "4%", notes: "Risk: data inconsistency", responsible: "Technical Consultant", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Validation", activity: "Conduct go-live readiness assessment including business, integration, and technical validation", description: "Go-live approval", workstream: "Cross-Stream", effortPct: "3%", notes: "", responsible: "PM + All", accountable: "Project Manager", consulted: "Business Sponsor", informed: "Steering Committee", milestone: false },
      { category: "Go-Live", activity: "Execute go-live with command center support and hypercare stabilization in PRD", description: "Stable production", workstream: "Cross-Stream", effortPct: "3%", notes: "Accelerator: war room", responsible: "All", accountable: "Project Manager", consulted: "Business Sponsor", informed: "Organization", milestone: true },
    ],
    run: [
      { category: "Support", activity: "Establish AMS support model including SLA definition and ticketing processes", description: "Support model", workstream: "Support", effortPct: "3%", notes: "Tool: ServiceNow", responsible: "PM + Customer", accountable: "IT Manager", consulted: "Business Users", informed: "Project Manager", milestone: false },
      { category: "Knowledge Transfer", activity: "Execute knowledge transfer to AMS team including functional, technical, and operational areas", description: "KT completed", workstream: "Change Management", effortPct: "2%", notes: "", responsible: "Functional + Technical", accountable: "Internal IT Lead", consulted: "Support Team", informed: "Management", milestone: false },
      { category: "Optimization", activity: "Transition system ownership to AMS and execute continuous improvements and support", description: "Stable operations", workstream: "Cross-Stream", effortPct: "2%", notes: "", responsible: "Support", accountable: "IT Manager", consulted: "Business SMEs", informed: "Project Manager", milestone: true },
    ],
  },
  brownfield: {
    discover: [
      { category: "Assessment", activity: "Current ECC Landscape Assessment", description: "Assess existing SAP ECC landscape, custom code volume, active interfaces and data object sizes to scope the conversion effort", workstream: "Technical", responsible: "Solution Architect", accountable: "Technical Lead", consulted: "Basis Team", informed: "Project Manager", milestone: false },
      { category: "Assessment", activity: "SAP Readiness Check and Simplification Analysis", description: "Run SAP Readiness Check, analyze Simplification Items and custom code impact using SAP Custom Code Migration app", workstream: "Technical", responsible: "SAP Consultant", accountable: "Technical Lead", consulted: "ABAP Team", informed: "Project Manager", milestone: true },
      { category: "Business Case", activity: "Business Case for System Conversion", description: "Develop ROI analysis comparing system conversion against reimplementation and present to executive stakeholders", workstream: "Project Management", responsible: "SAP Consultant", accountable: "Business Sponsor", consulted: "Finance", informed: "Board", milestone: false },
    ],
    prepare: [
      { category: "Readiness Check", activity: "Execute SAP Readiness Check 2.0 and analyze system conversion feasibility", effortPct: "5%", notes: "Tool: Readiness Check 2.0", responsible: "Technical + Basis", accountable: "Technical Lead", consulted: "Basis Team", informed: "Project Manager", milestone: false },
      { category: "Custom Code",     activity: "Perform custom code analysis using ATC and define remediation strategy", effortPct: "5%", notes: "", responsible: "Technical", accountable: "Technical Lead", consulted: "ABAP Team", informed: "Project Manager", milestone: false },
      { category: "Impact Analysis", activity: "Analyze simplification items and business impact across modules", effortPct: "4%", notes: "", responsible: "Functional", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Strategy",        activity: "Define conversion strategy including N+0, N+1, NZDT or DoDMO approach", effortPct: "5%", notes: "Critical decision driver", responsible: "PM + Basis", accountable: "Business Sponsor", consulted: "All Stream Leads", informed: "Steering Committee", milestone: true },
      { category: "Infrastructure",  activity: "Prepare sandbox and landscape (DEV/QAS/PRD) for conversion cycles", effortPct: "5%", notes: "", responsible: "Basis", accountable: "Technical Lead", consulted: "SAP Support", informed: "Project Manager", milestone: false },
    ],
    explore: [
      { category: "Delta Design",      activity: "Conduct delta design workshops to identify required functional changes", effortPct: "4%", notes: "", responsible: "Functional", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Data",              activity: "Execute data cleanup, archiving, and consistency validation in ECC system", effortPct: "3%", notes: "Accelerator: archiving", responsible: "Technical", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Integration",       activity: "Analyze integration impact and define required adjustments", effortPct: "3%", notes: "", responsible: "Integration", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
      { category: "Testing Strategy",  activity: "Define testing strategy including regression, SPAU/SPDD, and UAT cycles", effortPct: "3%", notes: "", responsible: "PM", accountable: "Business Sponsor", consulted: "All Teams", informed: "Steering Committee", milestone: false },
    ],
    realizeDevelop: [
      { category: "Conversion",   activity: "Execute SUM with DMO conversion cycles in sandbox and DEV environments (N+0 path)", effortPct: "10%", notes: "Tool: SUM with DMO", responsible: "Basis", accountable: "Technical Lead", consulted: "ABAP Team", informed: "Project Manager", milestone: false },
      { category: "Conversion",   activity: "Execute landscape transformation activities for N+1 approach if applicable", effortPct: "7%", notes: "Risk: dual landscape complexity", responsible: "Basis + Technical", accountable: "Technical Lead", consulted: "SAP Support", informed: "Project Manager", milestone: false },
      { category: "Conversion",   activity: "Execute NZDT / DoDMO approach for downtime optimization in large systems", effortPct: "5%", notes: "", responsible: "Basis", accountable: "Technical Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
      { category: "Custom Code",  activity: "Perform SPAU/SPDD adjustments and remediate custom code", effortPct: "6%", notes: "", responsible: "Technical", accountable: "Technical Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
    ],
    realizeUat: [
      { category: "Validation",  activity: "Validate converted data including finance reconciliation in QAS system", effortPct: "6%", notes: "Risk: FI inconsistencies", responsible: "Technical", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "UAT",         activity: "Execute SIT and UAT cycles in QAS and obtain formal business sign-off", effortPct: "6%", notes: "Customer dependency", responsible: "All", accountable: "Business Sponsor", consulted: "Business Users", informed: "Steering Committee", milestone: true },
    ],
    deploy: [
      { category: "Cutover",    activity: "Execute production system conversion using selected approach with controlled downtime", effortPct: "6%", notes: "", responsible: "Basis", accountable: "Project Manager", consulted: "All Teams", informed: "Organization", milestone: false },
      { category: "Validation", activity: "Perform business validation and reconciliation post conversion in PRD", effortPct: "4%", notes: "", responsible: "Customer", accountable: "Business Sponsor", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
      { category: "Go-Live",    activity: "Execute go-live and provide hypercare support", effortPct: "3%", notes: "", responsible: "All", accountable: "Project Manager", consulted: "Business Sponsor", informed: "Organization", milestone: true },
    ],
    run: [
      { category: "Support",      activity: "Establish AMS model and transition system to support team", effortPct: "3%", notes: "", responsible: "PM + Customer", accountable: "IT Manager", consulted: "Business Users", informed: "Project Manager", milestone: false },
      { category: "Optimization", activity: "Execute KT and optimize system performance post go-live", effortPct: "2%", notes: "", responsible: "Basis + Support", accountable: "IT Manager", consulted: "Business SMEs", informed: "Project Manager", milestone: true },
    ],
  },
  bluefield: {
    discover: [
      { category: "Assessment", activity: "Selective Migration Scope Assessment", description: "Assess which data objects, business processes and org structures to selectively migrate versus rebuild fresh in S/4HANA", workstream: "Project Management", responsible: "Solution Architect", accountable: "Business Sponsor", consulted: "Business SMEs", informed: "Board", milestone: false },
      { category: "Strategy", activity: "Bluefield Migration Strategy Definition", description: "Define selective data extraction, transformation and load strategy, and confirm tooling approach (SNP Transformation Cockpit or equivalent)", workstream: "Technical", responsible: "Data Lead", accountable: "Technical Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: true },
      { category: "Business Case", activity: "Business Case for Selective Migration", description: "Develop business case justifying selective migration approach including cost, risk and business continuity benefits over pure greenfield or brownfield", workstream: "Project Management", responsible: "SAP Consultant", accountable: "Business Sponsor", consulted: "Finance", informed: "Board", milestone: false },
    ],
    prepare: [
      { category: "Assessment",    activity: "Perform landscape and data assessment to define selective migration scope", effortPct: "5%", notes: "", responsible: "Technical + Basis", accountable: "Technical Lead", consulted: "Basis Team", informed: "Project Manager", milestone: false },
      { category: "Strategy",      activity: "Define data carve-out and transformation strategy using SNP CrystalBridge or Datavard tools", effortPct: "6%", notes: "Tool: SNP / Datavard", responsible: "Technical", accountable: "Technical Lead", consulted: "Tool Vendor", informed: "Project Manager", milestone: true },
      { category: "Scoping",       activity: "Identify business units, company codes, and historical data scope for migration", effortPct: "4%", notes: "", responsible: "Functional", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Transition",    activity: "Define transition approach including shell creation, phased rollout, or hybrid strategy", effortPct: "5%", notes: "Risk: scope misalignment", responsible: "PM", accountable: "Business Sponsor", consulted: "All Stream Leads", informed: "Steering Committee", milestone: false },
      { category: "Infrastructure",activity: "Provision S/4HANA landscape (DEV/QAS/PRD) for target system", effortPct: "4%", notes: "", responsible: "Basis", accountable: "Technical Lead", consulted: "SAP Support", informed: "Project Manager", milestone: false },
    ],
    explore: [
      { category: "Data Mapping",      activity: "Define data mapping and transformation rules using SNP or Datavard tools", effortPct: "6%", notes: "", responsible: "Technical", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Workshops",         activity: "Conduct business workshops to validate scope and redesigned processes", effortPct: "5%", notes: "", responsible: "Functional", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Integration",       activity: "Redesign integration landscape for hybrid systems", effortPct: "4%", notes: "", responsible: "Integration", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
      { category: "Testing Strategy",  activity: "Define testing strategy covering selective and retained data scenarios", effortPct: "4%", notes: "", responsible: "PM", accountable: "Business Sponsor", consulted: "All Teams", informed: "Steering Committee", milestone: false },
    ],
    realizeDevelop: [
      { category: "Data Migration",    activity: "Execute selective data migration using SNP CrystalBridge or Datavard tools into DEV/QAS", effortPct: "10%", notes: "Critical cost driver", responsible: "Technical", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Data Validation",   activity: "Apply transformation rules and validate data consistency in QAS system", effortPct: "7%", notes: "", responsible: "Technical", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Configuration",     activity: "Configure business processes aligned to migrated data", effortPct: "6%", notes: "", responsible: "Functional", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Integration",       activity: "Build or update integration interfaces across hybrid landscape", effortPct: "5%", notes: "", responsible: "Integration", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
    ],
    realizeUat: [
      { category: "UAT", activity: "Execute SIT and UAT cycles and obtain business sign-off", effortPct: "6%", notes: "", responsible: "All", accountable: "Business Sponsor", consulted: "Business Users", informed: "Steering Committee", milestone: true },
    ],
    deploy: [
      { category: "Cutover",    activity: "Execute phased or big-bang cutover and final selective migration to PRD", effortPct: "5%", notes: "", responsible: "PM", accountable: "Project Manager", consulted: "All Teams", informed: "Organization", milestone: false },
      { category: "Validation", activity: "Validate production data and business processes", effortPct: "4%", notes: "", responsible: "Customer", accountable: "Business Sponsor", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
      { category: "Go-Live",    activity: "Execute go-live and provide hypercare support", effortPct: "3%", notes: "", responsible: "All", accountable: "Project Manager", consulted: "Business Sponsor", informed: "Organization", milestone: true },
    ],
    run: [
      { category: "Support",      activity: "Establish AMS model and transition ownership to support team", effortPct: "3%", notes: "", responsible: "PM + Customer", accountable: "IT Manager", consulted: "Business Users", informed: "Project Manager", milestone: false },
      { category: "Monitoring",   activity: "Monitor hybrid landscape data consistency and integrations", effortPct: "2%", notes: "", responsible: "Technical", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Optimization", activity: "Execute continuous improvements and incident management", effortPct: "1%", notes: "", responsible: "Support", accountable: "IT Manager", consulted: "Business SMEs", informed: "Project Manager", milestone: true },
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
    
    const baseActs = acts[phase.key] || [];
    const activities = baseActs.map((act: any, idx: number) => ({
      ...act,
      startWeek: weekOffset + 1 + Math.floor(idx * phase.weeks / Math.max(baseActs.length, 1)),
      endWeek: weekOffset + Math.min(phase.weeks, Math.ceil((idx + 1) * phase.weeks / Math.max(baseActs.length, 1))),
      duration: `${Math.ceil(phase.weeks / Math.max(baseActs.length, 1))} weeks`,
    }));

    const thisOffset = weekOffset;
    weekOffset += phase.weeks;
    return {
      name: phase.name,
      startDate: phaseStart.toISOString().split("T")[0],
      endDate: phaseEnd.toISOString().split("T")[0],
      weeks: phase.weeks,
      weekStart: thisOffset,
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
  
  try {
    let client = openai;
    const freeModelId = FREE_MODEL_MAP[params.aiModel];
    const paidModelBase = PAID_MODEL_BASES[params.aiModel];

    let model = "gpt-5-mini";
    if (freeModelId) {
      model = freeModelId;
    } else if (paidModelBase && params.apiKey) {
      client = new OpenAI({ apiKey: params.apiKey, baseURL: paidModelBase.baseURL });
      model = paidModelBase.model;
    }

    const phaseLines = plan.phases
      .map((p: any) => `- ${p.name}: ${p.weeks} weeks`)
      .join("\n");
    const phaseNames = plan.phases.map((p: any) => p.name);

    const prompt = `You are a senior SAP S/4HANA Activate consultant. Generate a project plan for a ${params.transitionPath} implementation.

Phases: ${phaseLines}

Return ONLY valid JSON. No markdown, no extra text - raw JSON only:
{"summary":"2-3 sentence executive summary","phases":{"${phaseNames.join('":[],"')}":[]}}

Rules per phase (6–8 activities each):
Each activity: {"category":"","activity":"","description":"","workstream":"","responsible":"","accountable":"","consulted":"","informed":"","milestone":false}
- Prepare: SAP Cloud ALM setup, project charter, landscape provisioning, governance, risk register, team onboarding, standards
- Explore: FTS workshops FI/CO/MM/SD/PP, gap analysis, solution design, integration design, data migration strategy, security design
- Realize - Develop: config FI/CO/MM/SD, ABAP/Fiori dev, integration build, data migration mock, unit test, SIT, training materials
- Realize - UAT: UAT prep, UAT execution, defect management, cutover planning, rehearsal, training delivery, go-live readiness sign-off
- Deploy: final data load, production cutover, go-live execution, hypercare activation, stakeholder comms
- Run: hypercare support, incident management, performance tuning, knowledge transfer, project closure
Set milestone:true for kickoff, gap sign-off, UAT sign-off, go-live, closure.`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 3500,
    });

    const raw = (response.choices[0]?.message?.content || "").replace(/```json\n?|\n?```/g, "").trim();

    // Attempt robust parse - fix truncated JSON by closing open structures
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract summary at minimum using regex
      const sumMatch = raw.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (sumMatch) plan.summary = sumMatch[1];

      // Attempt to recover partial phases by closing the JSON
      const fixable = raw
        .replace(/,\s*$/, "")       // trailing comma
        .replace(/\}\s*$/, "}}") // close phases + root if cut
        + ']}';                      // close last array + phases + root
      try { parsed = JSON.parse(fixable); } catch { /* give up */ }
    }

    if (parsed?.summary) plan.summary = parsed.summary;

    if (parsed?.phases && typeof parsed.phases === "object") {
      for (const phase of plan.phases) {
        const aiActs: any[] = parsed.phases[phase.name];
        if (Array.isArray(aiActs) && aiActs.length >= 3) {
          const w0: number = phase.weekStart;
          const n = aiActs.length;
          phase.activities = aiActs.map((act: any, idx: number) => ({
            category:    act.category    || "General",
            activity:    act.activity    || `Activity ${idx + 1}`,
            description: act.description || "",
            workstream:  act.workstream  || "Cross-Stream",
            responsible: act.responsible || "SAP Consultant",
            accountable: act.accountable || "Project Manager",
            consulted:   act.consulted   || "Business SMEs",
            informed:    act.informed    || "Stakeholders",
            milestone:   !!act.milestone,
            startWeek: w0 + 1 + Math.floor(idx * phase.weeks / n),
            endWeek:   w0 + Math.min(phase.weeks, Math.ceil((idx + 1) * phase.weeks / n)),
            duration:  `${Math.ceil(phase.weeks / n)} weeks`,
          }));
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "AI generation failed - using static activity baseline");
  }

  return plan;
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel workbook builder  (Gantt + Resource Pivot)
// ─────────────────────────────────────────────────────────────────────────────

interface ResourceRowInput {
  role: string; location: string; level: string; remarks: string;
  weekEfforts: Record<number, number>;
}

async function buildExcelWorkbook(plan: any, aiModel: string, recipientEmail?: string, recipientName?: string, resourceRows?: ResourceRowInput[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "3B Michimap";
  wb.created = new Date();

  const DARK_BG    = "FF1A1A2E";
  const WHITE      = "FFFFFFFF";
  const GREY_LIGHT = "FFF5F5F5";
  const GREY_MID   = "FFD9D9D9";

  const PHASE_SOLID: Record<string, string> = {
    "Discover":          "FF3B82F6",  // blue-500
    "Prepare":           "FF22C55E",  // green-500
    "Explore":           "FFF97316",  // orange-500
    "Realize - Develop": "FFEAB308",  // yellow-500
    "Realize - UAT":     "FFEF4444",  // red-500
    "Deploy":            "FF14B8A6",  // teal-500
    "Run":               "FFA855F4",  // purple-500
  };
  const PHASE_LIGHT: Record<string, string> = {
    "Discover":          "FFDBEAFE",  // blue-100
    "Prepare":           "FFDCFCE7",  // green-100
    "Explore":           "FFFFEDD5",  // orange-100
    "Realize - Develop": "FFFEF9C3",  // yellow-100
    "Realize - UAT":     "FFFEE2E2",  // red-100
    "Deploy":            "FFCCFBF1",  // teal-100
    "Run":               "FFFAF5FF",  // purple-50
  };

  const startDate  = new Date((plan.projectStartDate || new Date().toISOString().split("T")[0]) + "T12:00:00");
  const totalWeeks = plan.totalWeeks as number;
  const pathLabel  = (plan.transitionPath || "").charAt(0).toUpperCase() + (plan.transitionPath || "").slice(1);
  const genDate    = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  // ────────────────────────────────────────────────
  // SHEET 1 - Project Plan (Gantt)
  // ────────────────────────────────────────────────
  const gantt = wb.addWorksheet("Project Plan", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    views: [{ state: "frozen", xSplit: 4, ySplit: 5 }],
  });

  const FIXED = 4; // Phase | Activity | Responsible | Notes / Tools / Risks

  // Set column widths
  gantt.getColumn(1).width = 16;
  gantt.getColumn(2).width = 48;
  gantt.getColumn(3).width = 22;
  gantt.getColumn(4).width = 32;
  for (let w = 1; w <= totalWeeks; w++) gantt.getColumn(FIXED + w).width = 3.6;

  // ── Row 1: Main Title ──
  gantt.mergeCells(1, 1, 1, FIXED + totalWeeks);
  const titleCell = gantt.getCell(1, 1);
  titleCell.value = `3B Michimap  -  SAP S/4HANA Pre-Sales Plan  (${pathLabel})`;
  titleCell.font  = { bold: true, size: 14, color: { argb: WHITE }, name: "Calibri" };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  gantt.getRow(1).height = 28;

  // ── Row 2: Liner / Disclaimer ──
  gantt.mergeCells(2, 1, 2, FIXED + totalWeeks);
  const linerCell = gantt.getCell(2, 1);
  linerCell.value = `Generated by 3B Michimap using ${aiModel}  |  ${genDate}  |  For internal pre-sales use only - not for client distribution. Estimates are indicative.`;
  linerCell.font  = { italic: true, size: 8, color: { argb: "FF888888" } };
  linerCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F0E8" } };
  linerCell.alignment = { horizontal: "center", vertical: "middle" };
  gantt.getRow(2).height = 16;

  // ── Row 3: Phase Legend (spans week columns) ──
  let phaseColStart = FIXED + 1;
  for (const phase of plan.phases as any[]) {
    const phaseColEnd = phaseColStart + phase.weeks - 1;
    if (phase.weeks > 1) {
      gantt.mergeCells(3, phaseColStart, 3, phaseColEnd);
    }
    const legendCell = gantt.getCell(3, phaseColStart);
    legendCell.value = phase.name;
    legendCell.font  = { bold: true, size: 8, color: { argb: WHITE } };
    legendCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: PHASE_SOLID[phase.name] || "FF888888" } };
    legendCell.alignment = { horizontal: "center", vertical: "middle" };
    phaseColStart = phaseColEnd + 1;
  }
  // blank for fixed cols in row 3
  for (let c = 1; c <= FIXED; c++) {
    gantt.getCell(3, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
  }
  gantt.getRow(3).height = 20;

  // ── Row 4: Week numbers + Month Year (two-line) ──
  for (let c = 1; c <= FIXED; c++) {
    gantt.getCell(4, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D2D2D" } };
  }
  for (let w = 1; w <= totalWeeks; w++) {
    const weekDate = new Date(startDate.getTime() + (w - 1) * 7 * 24 * 60 * 60 * 1000);
    const mon  = weekDate.toLocaleDateString("en-GB", { month: "short" });
    const yr2  = String(weekDate.getFullYear()).slice(2);
    const c    = gantt.getCell(4, FIXED + w);
    c.value    = `W${w}\n${mon} ${yr2}`;
    c.font     = { bold: true, size: 6, color: { argb: WHITE } };
    c.fill     = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D2D2D" } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
  gantt.getRow(4).height = 28;

  // ── Row 5: Column headers only (no dates — now embedded in row 4) ──
  const hdrLabels = ["Phase", "Activity", "Responsible", "Notes / Tools / Risks"];
  const hdrAligns = ["center", "left", "left", "left"] as const;
  for (let c = 1; c <= FIXED; c++) {
    const cell = gantt.getCell(5, c);
    cell.value = hdrLabels[c - 1];
    cell.font  = { bold: true, size: 9, color: { argb: WHITE } };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    cell.alignment = { horizontal: hdrAligns[c - 1], vertical: "middle" };
    cell.border = { right: { style: "thin", color: { argb: "FF444444" } } };
  }
  for (let w = 1; w <= totalWeeks; w++) {
    const c = gantt.getCell(5, FIXED + w);
    c.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    c.border = { right: { style: "hair", color: { argb: GREY_MID } }, bottom: { style: "thin", color: { argb: GREY_MID } } };
  }
  gantt.getRow(5).height = 18;

  // ── Rows 6+: Activity data ──
  let dataRow = 6;
  for (const phase of plan.phases as any[]) {
    const phaseFirstRow = dataRow;
    const phaseSolid = PHASE_SOLID[phase.name] || "FF888888";
    const phaseLight = PHASE_LIGHT[phase.name] || "FFF0F0F0";

    for (let i = 0; i < phase.activities.length; i++) {
      const act = phase.activities[i];
      const row = gantt.getRow(dataRow);
      row.height = 16;

      // Phase cell (only first activity of phase)
      const phaseCell = gantt.getCell(dataRow, 1);
      if (i === 0) {
        phaseCell.value = phase.name;
        phaseCell.font  = { bold: true, size: 8, color: { argb: WHITE } };
      }
      phaseCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: phaseSolid } };
      phaseCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      phaseCell.border    = { right: { style: "thin", color: { argb: "FF444444" } }, bottom: { style: "hair", color: { argb: "FF666666" } } };

      // Activity cell
      const actCell = gantt.getCell(dataRow, 2);
      actCell.value = act.activity;
      actCell.font  = { size: 8, bold: act.milestone };
      actCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? WHITE : GREY_LIGHT } };
      actCell.alignment = { vertical: "middle", horizontal: "left" };
      actCell.border    = { right: { style: "hair", color: { argb: GREY_MID } }, bottom: { style: "hair", color: { argb: GREY_MID } } };

      // Responsible cell
      const respCell = gantt.getCell(dataRow, 3);
      respCell.value = act.responsible || "Project Team";
      respCell.font  = { size: 8, color: { argb: "FF555555" } };
      respCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? WHITE : GREY_LIGHT } };
      respCell.alignment = { vertical: "middle", horizontal: "left" };
      respCell.border    = { right: { style: "hair", color: { argb: GREY_MID } }, bottom: { style: "hair", color: { argb: GREY_MID } } };

      // Notes / Tools / Risks cell
      const notesCell = gantt.getCell(dataRow, 4);
      notesCell.value = act.notes || "";
      notesCell.font  = { size: 7, italic: true, color: { argb: "FF555555" } };
      notesCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? WHITE : GREY_LIGHT } };
      notesCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      notesCell.border    = { right: { style: "thin", color: { argb: "FF444444" } }, bottom: { style: "hair", color: { argb: GREY_MID } } };

      // Week cells
      for (let w = 1; w <= totalWeeks; w++) {
        const wCell = gantt.getCell(dataRow, FIXED + w);
        const inRange = w >= act.startWeek && w <= act.endWeek;
        wCell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: inRange ? phaseLight : (i % 2 === 0 ? WHITE : GREY_LIGHT) } };
        wCell.border = { right: { style: "hair", color: { argb: GREY_MID } }, bottom: { style: "hair", color: { argb: GREY_MID } } };
        if (inRange && act.milestone) {
          wCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: phaseSolid } };
        }
      }

      dataRow++;
    }

    // Merge phase cells in column A
    if (phase.activities.length > 1) {
      gantt.mergeCells(phaseFirstRow, 1, dataRow - 1, 1);
    }
  }

  // ── Plan-only: add footer and return early ──
  if (!resourceRows || resourceRows.length === 0) {
    gantt.mergeCells(dataRow, 1, dataRow, FIXED + totalWeeks);
    const footCellPlan = gantt.getCell(dataRow, 1);
    footCellPlan.value = `© 3B Michimap  |  Transition: ${pathLabel}  |  Model: ${aiModel}  |  Total: ${totalWeeks} weeks  |  Estimates are indicative and for pre-sales guidance only.`;
    footCellPlan.font  = { italic: true, size: 7, color: { argb: "FF888888" } };
    footCellPlan.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F0E8" } };
    footCellPlan.alignment = { horizontal: "center", vertical: "middle" };
    gantt.getRow(dataRow).height = 14;
    return wb;
  }

  // ────────────────────────────────────────────────────────────────────────
  // EFFORT SECTION — appended on "Project Plan" sheet, below activity table
  // ────────────────────────────────────────────────────────────────────────

  // Helper: column index → Excel letter (A, B, … Z, AA, …)
  const colToLetter = (col: number): string => {
    let letter = ""; let c = col;
    while (c > 0) { c--; letter = String.fromCharCode(65 + (c % 26)) + letter; c = Math.floor(c / 26); }
    return letter;
  };

  // Total column on gantt sheet (one column after all week cols)
  const TOTAL_COL_G = FIXED + totalWeeks + 1;
  gantt.getColumn(TOTAL_COL_G).width = 10;

  // Week → phase lookup
  const weekPhase: string[] = new Array(totalWeeks + 1).fill("");
  for (const ph of plan.phases as any[]) {
    for (let w = ph.weekStart + 1; w <= ph.weekStart + ph.weeks; w++) weekPhase[w] = ph.name;
  }

  // Map user-supplied resource rows
  const RESOURCES: { role: string; loc: string; level: string; weekEfforts: Record<number,number> }[] =
    resourceRows.map(r => ({ role: r.role, loc: r.location, level: r.level, weekEfforts: r.weekEfforts }));
  const NUM_ROWS = RESOURCES.length;

  const SHORT_MONTHS_E = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // ── Blank separator ──
  gantt.getRow(dataRow).height = 6;
  dataRow++;

  // ── Effort section title ──
  gantt.mergeCells(dataRow, 1, dataRow, TOTAL_COL_G);
  {
    const c = gantt.getCell(dataRow, 1);
    c.value = "Resource Effort Estimation  (Days per Week)";
    c.font  = { bold: true, size: 12, color: { argb: WHITE }, name: "Calibri" };
    c.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D7A4F" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  }
  gantt.getRow(dataRow).height = 24;
  dataRow++;

  // ── Phase colour band ──
  for (let c = 1; c <= FIXED; c++) {
    gantt.getCell(dataRow, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D2D2D" } };
  }
  {
    let bc = FIXED + 1;
    for (const ph of plan.phases as any[]) {
      const bandEnd = bc + ph.weeks - 1;
      if (ph.weeks > 1) gantt.mergeCells(dataRow, bc, dataRow, bandEnd);
      const cell = gantt.getCell(dataRow, bc);
      cell.value = ph.name;
      cell.font  = { bold: true, size: 8, color: { argb: WHITE } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: PHASE_SOLID[ph.name] || "FF888888" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      bc = bandEnd + 1;
    }
  }
  gantt.getCell(dataRow, TOTAL_COL_G).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D7A4F" } };
  gantt.getRow(dataRow).height = 18;
  dataRow++;

  // ── Column headers ──
  const effLabels = ["No", "Role / Consultant", "Location", "Level"];
  const effAligns = ["center", "left", "center", "center"] as const;
  for (let c = 1; c <= FIXED; c++) {
    const cell = gantt.getCell(dataRow, c);
    cell.value = effLabels[c - 1];
    cell.font  = { bold: true, size: 9, color: { argb: WHITE } };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    cell.alignment = { horizontal: effAligns[c - 1], vertical: "middle" };
    cell.border = { right: { style: "thin", color: { argb: "FF444444" } } };
  }
  for (let w = 1; w <= totalWeeks; w++) {
    const bg  = PHASE_SOLID[weekPhase[w]] || "FF444444";
    const wd  = new Date(startDate.getTime() + (w - 1) * 7 * 24 * 60 * 60 * 1000);
    const lbl = `W${w}\n${wd.getDate()} ${SHORT_MONTHS_E[wd.getMonth()]}`;
    const cell = gantt.getCell(dataRow, FIXED + w);
    cell.value = lbl;
    cell.font  = { bold: true, size: 6, color: { argb: WHITE } };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    cell.alignment = { horizontal: "center", vertical: "bottom", textRotation: 90 };
    cell.border = { right: { style: "hair", color: { argb: "FFBBBBBB" } } };
  }
  {
    const th = gantt.getCell(dataRow, TOTAL_COL_G);
    th.value = "Total\nDays";
    th.font  = { bold: true, size: 8, color: { argb: WHITE } };
    th.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D7A4F" } };
    th.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
  gantt.getRow(dataRow).height = 60;
  dataRow++;

  // ── Resource data rows ──
  const effDataStart = dataRow;
  for (let i = 0; i < NUM_ROWS; i++) {
    const rowNum = dataRow;
    const res = RESOURCES[i];
    const rowBg = i % 2 === 0 ? WHITE : GREY_LIGHT;
    gantt.getRow(rowNum).height = 17;

    const mkCell = (col: number, val: any, hAlign: "center"|"left" = "center", extraBorder = false) => {
      const cell = gantt.getCell(rowNum, col);
      cell.value = val;
      cell.font  = { size: 9 };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
      cell.alignment = { horizontal: hAlign, vertical: "middle" };
      cell.border = {
        right:  { style: extraBorder ? "thin" : "hair", color: { argb: extraBorder ? "FF444444" : "FFCCCCCC" } },
        bottom: { style: "hair", color: { argb: "FFCCCCCC" } },
      };
    };

    mkCell(1, i + 1);
    mkCell(2, res.role, "left");
    mkCell(3, res.loc);
    mkCell(4, res.level, "center", true); // right border after Level (frozen col boundary)

    // Week effort cells
    for (let w = 1; w <= totalWeeks; w++) {
      const effortVal = res.weekEfforts[w] ?? 0;
      const wCell = gantt.getCell(rowNum, FIXED + w);
      wCell.value    = effortVal;
      wCell.font     = { size: 8, color: { argb: effortVal > 0 ? "FF0D6E3B" : "FF333333" } };
      wCell.fill     = { type: "pattern", pattern: "solid", fgColor: { argb: PHASE_LIGHT[weekPhase[w]] || GREY_LIGHT } };
      wCell.alignment = { horizontal: "center", vertical: "middle" };
      wCell.numFmt   = "0.#";
      wCell.border   = { right: { style: "hair", color: { argb: "FFBBBBBB" } }, bottom: { style: "hair", color: { argb: "FFBBBBBB" } } };
    }

    // Total cell (SUM formula)
    const wFirst = colToLetter(FIXED + 1);
    const wLast  = colToLetter(FIXED + totalWeeks);
    const totCell = gantt.getCell(rowNum, TOTAL_COL_G);
    totCell.value = { formula: `SUM(${wFirst}${rowNum}:${wLast}${rowNum})` };
    totCell.font  = { bold: true, size: 9, color: { argb: "FF15803D" } };
    totCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
    totCell.alignment = { horizontal: "center", vertical: "middle" };
    totCell.numFmt = "0.#";
    totCell.border = { right: { style: "thin", color: { argb: "FF444444" } }, bottom: { style: "hair", color: { argb: "FFCCCCCC" } } };

    dataRow++;
  }

  // Dropdowns for Location (col C=3) and Level (col D=4)
  gantt.dataValidations.add(`C${effDataStart}:C${effDataStart + NUM_ROWS - 1}`, {
    type: "list" as any, allowBlank: true, showDropDown: false,
    formulae: ['"Onsite,Offshore"'],
  } as any);
  gantt.dataValidations.add(`D${effDataStart}:D${effDataStart + NUM_ROWS - 1}`, {
    type: "list" as any, allowBlank: true, showDropDown: false,
    formulae: ['"Solution Architect,Senior Consultant,Junior Consultant,Project Manager,Service Delivery Manager,Subject Matter Expert,AI Consultant"'],
  } as any);

  // ── TOTAL row ──
  const totRowG = dataRow;
  gantt.getRow(totRowG).height = 20;
  gantt.mergeCells(totRowG, 1, totRowG, FIXED);
  {
    const tl = gantt.getCell(totRowG, 1);
    tl.value = "TOTAL";
    tl.font  = { bold: true, size: 10, color: { argb: WHITE } };
    tl.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    tl.alignment = { horizontal: "center", vertical: "middle" };
  }
  for (let w = 1; w <= totalWeeks; w++) {
    const colLet = colToLetter(FIXED + w);
    const tc = gantt.getCell(totRowG, FIXED + w);
    tc.value = { formula: `SUM(${colLet}${effDataStart}:${colLet}${effDataStart + NUM_ROWS - 1})` };
    tc.font  = { bold: true, size: 9, color: { argb: WHITE } };
    tc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    tc.alignment = { horizontal: "center", vertical: "middle" };
    tc.numFmt = "0";
  }
  {
    const grandLet  = colToLetter(TOTAL_COL_G);
    const grandCell = gantt.getCell(totRowG, TOTAL_COL_G);
    grandCell.value = { formula: `SUM(${grandLet}${effDataStart}:${grandLet}${effDataStart + NUM_ROWS - 1})` };
    grandCell.font  = { bold: true, size: 10, color: { argb: WHITE } };
    grandCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D7A4F" } };
    grandCell.alignment = { horizontal: "center", vertical: "middle" };
    grandCell.numFmt = "0";
  }
  dataRow = totRowG + 1;

  // ── Footer (end of all content on Project Plan sheet) ──
  gantt.mergeCells(dataRow, 1, dataRow, TOTAL_COL_G);
  {
    const fc = gantt.getCell(dataRow, 1);
    fc.value = `© 3B Michimap  |  Transition: ${pathLabel}  |  Model: ${aiModel}  |  Total: ${totalWeeks} weeks  |  Estimates are indicative and for pre-sales guidance only.`;
    fc.font  = { italic: true, size: 7, color: { argb: "FF888888" } };
    fc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F0E8" } };
    fc.alignment = { horizontal: "center", vertical: "middle" };
    gantt.getRow(dataRow).height = 14;
  }

  // ────────────────────────────────────────────────────────────────────────
  // SHEET 2 — Effort Summary (pivot tables referencing 'Project Plan' data)
  // ────────────────────────────────────────────────────────────────────────
  const pivot = wb.addWorksheet("Effort Summary", {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });

  // Cross-sheet reference helpers
  const SHT = "'Project Plan'";
  // Level column = col D (FIXED=4) on Project Plan sheet
  const levArrX = `${SHT}!$D$${effDataStart}:$D$${effDataStart + NUM_ROWS - 1}`;
  // Sum week columns firstW..lastW on Project Plan sheet (column-by-column for SUMPRODUCT)
  const weekRowSumX = (firstW: number, lastW: number): string => {
    const terms: string[] = [];
    for (let w = firstW; w <= lastW; w++) {
      const col = colToLetter(FIXED + w);
      terms.push(`${SHT}!${col}${effDataStart}:${col}${effDataStart + NUM_ROWS - 1}`);
    }
    return terms.join("+");
  };
  const allWeeksExprX = weekRowSumX(1, totalWeeks);

  // Build phase ranges
  interface PhaseRange { name: string; firstWeek: number; lastWeek: number; }
  const PHASE_RANGES: PhaseRange[] = (plan.phases as any[]).map(ph => ({
    name: ph.name, firstWeek: ph.weekStart + 1, lastWeek: ph.weekStart + ph.weeks,
  }));

  // Build year ranges
  interface YearRange { year: number; firstWeek: number; lastWeek: number; }
  const YEAR_RANGES: YearRange[] = [];
  {
    const sy = startDate.getFullYear();
    const ey = new Date(startDate.getTime() + totalWeeks * 7 * 24 * 60 * 60 * 1000).getFullYear();
    for (let y = sy; y <= ey; y++) {
      const wks: number[] = [];
      for (let w = 1; w <= totalWeeks; w++) {
        if (new Date(startDate.getTime() + (w - 1) * 7 * 24 * 60 * 60 * 1000).getFullYear() === y) wks.push(w);
      }
      if (wks.length) YEAR_RANGES.push({ year: y, firstWeek: wks[0], lastWeek: wks[wks.length - 1] });
    }
  }

  // ── Shared cell-writer for pivot tables ──
  function pivotCell(row: number, col: number, value: any, opts: {
    bg: string; fontColor?: string; bold?: boolean; size?: number;
    hAlign?: "center" | "left" | "right"; borderRight?: string; borderBottom?: string; numFmt?: string;
  }) {
    const cell = pivot.getCell(row, col);
    cell.value = value;
    cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 8, color: { argb: opts.fontColor ?? "FF1A1A1A" } };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: opts.bg } };
    cell.alignment = { horizontal: opts.hAlign ?? "center", vertical: "middle" };
    if (opts.numFmt) cell.numFmt = opts.numFmt;
    cell.border = {
      right:  { style: "hair", color: { argb: opts.borderRight  ?? "FFCCCCCC" } },
      bottom: { style: "hair", color: { argb: opts.borderBottom ?? "FFCCCCCC" } },
    };
  }

  const PIVOT_LEVELS = [
    "Solution Architect", "Senior Consultant", "Junior Consultant",
    "Subject Matter Expert", "Project Manager", "Service Delivery Manager", "AI Consultant",
  ];
  const maxPivotCols = Math.max(PHASE_RANGES.length, YEAR_RANGES.length) + 2;

  // ── Pivot sheet: Title ──
  let pivotRow = 1;
  pivot.mergeCells(pivotRow, 1, pivotRow, maxPivotCols);
  {
    const c = pivot.getCell(pivotRow, 1);
    c.value = "Effort Summary  —  3B Michimap";
    c.font  = { bold: true, size: 13, color: { argb: WHITE } };
    c.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    pivot.getRow(pivotRow).height = 28;
  }
  pivotRow++;
  pivot.mergeCells(pivotRow, 1, pivotRow, maxPivotCols);
  {
    const c = pivot.getCell(pivotRow, 1);
    c.value = `Transition: ${pathLabel}  |  Total: ${totalWeeks} weeks  |  Model: ${aiModel}  |  Generated: ${genDate}  |  For internal pre-sales use only`;
    c.font  = { italic: true, size: 8, color: { argb: "FF555555" } };
    c.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F0E8" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    pivot.getRow(pivotRow).height = 16;
  }
  pivotRow += 2; // blank spacer

  // ─────────────────────────────────────────────────────────────
  // TABLE 1 — Level × Phase Effort Summary
  // ─────────────────────────────────────────────────────────────
  const T1_START = pivotRow;
  const T1_COLS  = 1 + PHASE_RANGES.length + 1;

  pivot.mergeCells(T1_START, 1, T1_START, T1_COLS);
  {
    const c = pivot.getCell(T1_START, 1);
    c.value = "Effort Summary by Level & Phase (Days)";
    c.font  = { bold: true, size: 9, color: { argb: WHITE } };
    c.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    pivot.getRow(T1_START).height = 18;
  }

  const T1_HDR = T1_START + 1;
  pivot.getRow(T1_HDR).height = 28;
  ["Level", ...PHASE_RANGES.map(p => p.name), "Total Days"].forEach((h, i, arr) => {
    const cell = pivot.getCell(T1_HDR, 1 + i);
    cell.value = h;
    cell.font  = { bold: true, size: 8, color: { argb: WHITE } };
    cell.fill  = { type: "pattern", pattern: "solid",
                   fgColor: { argb: i === 0 ? DARK_BG : i < arr.length - 1 ? "FF374151" : "FF1C3A2D" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { right: { style: "thin", color: { argb: "FF444444" } }, bottom: { style: "thin", color: { argb: "FF444444" } } };
  });

  PIVOT_LEVELS.forEach((level, i) => {
    const rn = T1_HDR + 1 + i;
    const bg = i % 2 === 0 ? WHITE : GREY_LIGHT;
    pivot.getRow(rn).height = 15;
    pivotCell(rn, 1, level, { bg, hAlign: "left", bold: true });
    PHASE_RANGES.forEach((ph, pi) => {
      const phExpr = weekRowSumX(ph.firstWeek, ph.lastWeek);
      pivotCell(rn, 2 + pi, { formula: `SUMPRODUCT((${levArrX}="${level}")*(${phExpr}))` }, { bg, numFmt: "0.#" });
    });
    const totC = pivot.getCell(rn, 1 + PHASE_RANGES.length + 1);
    totC.value  = { formula: `SUMPRODUCT((${levArrX}="${level}")*(${allWeeksExprX}))` };
    totC.font   = { bold: true, size: 8, color: { argb: "FF15803D" } };
    totC.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    totC.alignment = { horizontal: "center", vertical: "middle" };
    totC.numFmt = "0.#";
    totC.border = { right: { style: "thin", color: { argb: "FF444444" } }, bottom: { style: "hair", color: { argb: "FFCCCCCC" } } };
  });

  const T1_TOT = T1_HDR + 1 + PIVOT_LEVELS.length;
  pivot.getRow(T1_TOT).height = 18;
  {
    const c = pivot.getCell(T1_TOT, 1);
    c.value = "GRAND TOTAL";
    c.font  = { bold: true, size: 9, color: { argb: WHITE } };
    c.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  }
  PHASE_RANGES.forEach((ph, pi) => {
    const gc = pivot.getCell(T1_TOT, 2 + pi);
    gc.value = { formula: `SUMPRODUCT(${weekRowSumX(ph.firstWeek, ph.lastWeek)})` };
    gc.font  = { bold: true, size: 9, color: { argb: WHITE } };
    gc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    gc.alignment = { horizontal: "center", vertical: "middle" };
    gc.numFmt = "0";
  });
  {
    const gc = pivot.getCell(T1_TOT, 1 + PHASE_RANGES.length + 1);
    gc.value = { formula: `SUMPRODUCT(${allWeeksExprX})` };
    gc.font  = { bold: true, size: 9, color: { argb: WHITE } };
    gc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D7A4F" } };
    gc.alignment = { horizontal: "center", vertical: "middle" };
    gc.numFmt = "0";
  }

  // ─────────────────────────────────────────────────────────────
  // TABLE 2 — Level × Year Effort Summary
  // ─────────────────────────────────────────────────────────────
  const T2_START = T1_TOT + 2;
  const T2_COLS  = 1 + YEAR_RANGES.length + 1;

  pivot.mergeCells(T2_START, 1, T2_START, T2_COLS);
  {
    const c = pivot.getCell(T2_START, 1);
    c.value = "Effort Summary by Level & Year (Days)";
    c.font  = { bold: true, size: 9, color: { argb: WHITE } };
    c.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    pivot.getRow(T2_START).height = 18;
  }

  const T2_HDR = T2_START + 1;
  pivot.getRow(T2_HDR).height = 16;
  ["Level", ...YEAR_RANGES.map(y => String(y.year)), "Total Days"].forEach((h, i, arr) => {
    const cell = pivot.getCell(T2_HDR, 1 + i);
    cell.value = h;
    cell.font  = { bold: true, size: 8, color: { argb: WHITE } };
    cell.fill  = { type: "pattern", pattern: "solid",
                   fgColor: { argb: i === 0 ? DARK_BG : i < arr.length - 1 ? "FF374151" : "FF1C3A2D" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { right: { style: "thin", color: { argb: "FF444444" } }, bottom: { style: "thin", color: { argb: "FF444444" } } };
  });

  PIVOT_LEVELS.forEach((level, i) => {
    const rn = T2_HDR + 1 + i;
    const bg = i % 2 === 0 ? WHITE : GREY_LIGHT;
    pivot.getRow(rn).height = 15;
    pivotCell(rn, 1, level, { bg, hAlign: "left", bold: true });
    YEAR_RANGES.forEach((yr, yi) => {
      const yrExpr = weekRowSumX(yr.firstWeek, yr.lastWeek);
      pivotCell(rn, 2 + yi, { formula: `SUMPRODUCT((${levArrX}="${level}")*(${yrExpr}))` }, { bg, numFmt: "0.#" });
    });
    const totC = pivot.getCell(rn, 1 + YEAR_RANGES.length + 1);
    totC.value  = { formula: `SUMPRODUCT((${levArrX}="${level}")*(${allWeeksExprX}))` };
    totC.font   = { bold: true, size: 8, color: { argb: "FF15803D" } };
    totC.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    totC.alignment = { horizontal: "center", vertical: "middle" };
    totC.numFmt = "0.#";
    totC.border = { right: { style: "thin", color: { argb: "FF444444" } }, bottom: { style: "hair", color: { argb: "FFCCCCCC" } } };
  });

  const T2_TOT = T2_HDR + 1 + PIVOT_LEVELS.length;
  pivot.getRow(T2_TOT).height = 18;
  {
    const c = pivot.getCell(T2_TOT, 1);
    c.value = "GRAND TOTAL";
    c.font  = { bold: true, size: 9, color: { argb: WHITE } };
    c.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  }
  YEAR_RANGES.forEach((yr, yi) => {
    const gc = pivot.getCell(T2_TOT, 2 + yi);
    gc.value = { formula: `SUMPRODUCT(${weekRowSumX(yr.firstWeek, yr.lastWeek)})` };
    gc.font  = { bold: true, size: 9, color: { argb: WHITE } };
    gc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    gc.alignment = { horizontal: "center", vertical: "middle" };
    gc.numFmt = "0";
  });
  {
    const gc = pivot.getCell(T2_TOT, 1 + YEAR_RANGES.length + 1);
    gc.value = { formula: `SUMPRODUCT(${allWeeksExprX})` };
    gc.font  = { bold: true, size: 9, color: { argb: WHITE } };
    gc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D7A4F" } };
    gc.alignment = { horizontal: "center", vertical: "middle" };
    gc.numFmt = "0";
  }

  // Column widths for pivot summary sheet
  const maxDataCols = Math.max(PHASE_RANGES.length, YEAR_RANGES.length);
  pivot.getColumn(1).width = 24;
  for (let c = 2; c <= 1 + maxDataCols; c++) pivot.getColumn(c).width = 14;
  pivot.getColumn(1 + maxDataCols + 1).width = 12;

  return wb;
}

// In-memory plan store (in production this would be in DB)
const planStore = new Map<string, any>();

function parseDevice(ua: string): string {
  if (!ua) return "Unknown";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Desktop";
}

async function getLocation(ip: string): Promise<string> {
  try {
    if (!ip || ip === "127.0.0.1" || ip === "::1") return "Local";
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,status`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json() as any;
    if (data.status === "success") return `${data.city || ""}, ${data.country || ""}`.replace(/^, |, $/, "");
    return "Unknown";
  } catch {
    return "Unknown";
  }
}

router.post("/plan", async (req, res) => {
  try {
    const { aiModel, apiKey, transitionPath, projectStartDate, phases } = req.body;
    
    if (!transitionPath || !projectStartDate || !phases) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const plan = await generateWithAI({ aiModel, apiKey, transitionPath, projectStartDate, phases });
    
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    const realizeUatWeeks = phases.realizeUat?.weeks || 6;
    const totalWeeks = (phases.discover?.included ? phases.discover.weeks : 0) +
      phases.prepare.weeks + phases.explore.weeks + phases.realizeDevelop.weeks +
      realizeUatWeeks + phases.deploy.weeks + phases.run.weeks;

    const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
    const ua = req.headers["user-agent"] || "";
    const device = parseDevice(ua);
    const location = await getLocation(ip);

    let generationId: number | null = null;
    try {
      const inserted = await db.insert(generationsTable).values({
        transitionPath,
        aiModel,
        projectStartDate,
        totalWeeks,
        planData: plan,
        downloaded: false,
        ipAddress: ip,
        location,
        device,
        userAgent: ua.slice(0, 500),
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

// Map downloadToken -> planId (set after email is sent successfully)
const downloadTokens = new Map<string, string>();

router.post("/send-email", async (req, res) => {
  try {
    const { planId, email, name } = req.body;
    if (!planId || !email) return res.status(400).json({ error: "planId and email are required" });

    const plan = planStore.get(planId);
    if (!plan) return res.status(404).json({ error: "Plan not found or expired" });

    const workbook = await buildExcelWorkbook(plan, plan.requestBody?.aiModel || "Gemini 2.0 Flash", email, name || undefined);
    const buffer = await workbook.xlsx.writeBuffer();
    const excelBuffer = Buffer.from(buffer);
    const fileName = `3B_Michimap_${plan.transitionPath}_${plan.projectStartDate}.xlsx`;

    const emailResult = await sendPlanEmail({
      to: email,
      name: name || undefined,
      transitionPath: plan.transitionPath,
      totalWeeks: plan.totalWeeks,
      projectStartDate: plan.projectStartDate,
      excelBuffer,
      fileName,
    });

    if (!emailResult.success) {
      return res.status(500).json({ error: emailResult.error || "Failed to send email" });
    }

    const downloadToken = randomUUID();
    downloadTokens.set(downloadToken, planId);
    setTimeout(() => downloadTokens.delete(downloadToken), 60 * 60 * 1000);

    if (plan.generationId) {
      await db.update(generationsTable)
        .set({
          visitorEmail: email,
          visitorName: name || null,
          emailSent: true,
          downloadToken,
        })
        .where(eq(generationsTable.id, plan.generationId))
        .catch(() => {});
    }

    res.json({ success: true, downloadToken });
  } catch (err) {
    logger.error({ err }, "Send email error");
    res.status(500).json({ error: "Failed to send email" });
  }
});

router.post("/download", async (req, res) => {
  const { planId, downloadToken, resourceRows } = req.body;
  const resolvedPlanId = downloadToken ? downloadTokens.get(downloadToken) : planId;
  if (!resolvedPlanId) return res.status(403).json({ error: "Invalid or expired download token" });

  const plan = planStore.get(resolvedPlanId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  try {
    const storedPlan = planStore.get(resolvedPlanId);

    const workbook = await buildExcelWorkbook(plan, plan.requestBody?.aiModel || "Gemini 2.0 Flash", undefined, undefined, resourceRows);

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

// ── Chat / Plan Refinement endpoint ────────────────────────────────────────
router.post("/chat", async (req, res) => {
  try {
    const { planId, message, plan: clientPlan, aiModel, apiKey, transitionPath } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    const currentPlan: any = planId ? planStore.get(planId) : clientPlan;
    if (!currentPlan) return res.status(400).json({ error: "No plan context. Generate a plan first." });

    // Pick model
    const isFree = !PAID_MODEL_BASES[aiModel];
    let client = openai;
    let model = FREE_MODEL_MAP[aiModel] || "gpt-5-mini";
    if (!isFree && apiKey) {
      const base = PAID_MODEL_BASES[aiModel];
      client = new OpenAI({ baseURL: base.baseURL, apiKey }) as any;
      model = base.model;
    }

    // Build phase context string (compact)
    const phaseCtx = (currentPlan.phases as any[]).map((p: any) => {
      const acts = (p.activities || []).map((a: any) => a.activity).join("; ");
      return `${p.name} (${p.weeks}w): ${acts || "default activities"}`;
    }).join("\n");

    const systemPrompt = `You are a senior SAP S/4HANA Activate consultant helping refine a project plan.
Current plan: ${currentPlan.transitionPath || transitionPath || "brownfield"} transition, ${currentPlan.totalWeeks || "?"} weeks total.
Phases:\n${phaseCtx}

When the user asks you to list, add, or refine activities for one or more phases:
1. Return ONLY valid JSON in this exact structure (no markdown, no extra text):
{
  "message": "brief natural language explanation of what you changed",
  "phases": {
    "Phase Name": [
      {"category":"...","activity":"...","description":"...","workstream":"...","responsible":"...","accountable":"...","consulted":"...","informed":"...","milestone":false}
    ]
  }
}
2. Include 5–12 activities per modified phase. Be specific and realistic.
3. Workstream values: Finance, Procurement, Sales, Operations, Technical, Data Management, Project Management, Quality Assurance, Change Management, Cross-Stream, Support, AI & Analytics.
4. Only include the phases you are modifying in the response - omit unchanged phases.
5. Set milestone:true for: kickoff, sign-offs, go-live, closure.
If the user asks a general question (not requesting plan changes), still return JSON with:
{ "message": "your answer here", "phases": {} }`;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      max_completion_tokens: 2500,
    });

    const raw = (response.choices[0]?.message?.content || "").replace(/```json\n?|\n?```/g, "").trim();
    let parsed: any = { message: "Done!", phases: {} };
    try { parsed = JSON.parse(raw); } catch {
      const msgMatch = raw.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (msgMatch) parsed.message = msgMatch[1];
    }

    let updatedPlan: any = null;
    if (parsed.phases && Object.keys(parsed.phases).length > 0) {
      updatedPlan = JSON.parse(JSON.stringify(currentPlan));
      for (const phase of updatedPlan.phases) {
        const aiActs: any[] = parsed.phases[phase.name];
        if (Array.isArray(aiActs) && aiActs.length > 0) {
          const w0: number = phase.weekStart;
          const n = aiActs.length;
          phase.activities = aiActs.map((act: any, idx: number) => ({
            category:    act.category    || "General",
            activity:    act.activity    || `Activity ${idx + 1}`,
            description: act.description || "",
            workstream:  act.workstream  || "Cross-Stream",
            responsible: act.responsible || "SAP Consultant",
            accountable: act.accountable || "Project Manager",
            consulted:   act.consulted   || "Business SMEs",
            informed:    act.informed    || "Stakeholders",
            milestone:   !!act.milestone,
            startWeek: w0 + 1 + Math.floor(idx * phase.weeks / n),
            endWeek:   w0 + Math.min(phase.weeks, Math.ceil((idx + 1) * phase.weeks / n)),
            duration:  `${Math.ceil(phase.weeks / n)} weeks`,
          }));
        }
      }
      if (planId) planStore.set(planId, updatedPlan);
    }

    res.json({ assistantMessage: parsed.message || "Done!", updatedPlan });
  } catch (err) {
    logger.error({ err }, "Chat error");
    res.status(500).json({ error: "Failed to process chat message" });
  }
});

export default router;
