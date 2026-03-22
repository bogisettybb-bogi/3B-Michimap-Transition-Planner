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
  "gpt-5-mini":       "gpt-5-mini",   // GPT-5 mini (best free)
  "gemini-2-5-flash": "gpt-5-mini",   // Gemini 2.5 Flash (best free)
  "gpt-4o-mini":      "gpt-5-nano",   // GPT-4o mini
  "gpt-4o-free":      "gpt-5-mini",   // GPT-4o
  "claude-3-5-haiku": "gpt-5-nano",   // Claude 3.5 Haiku (proxied)
  "gemini-2-flash":   "gpt-5-mini",   // Gemini 2.0 Flash (proxied)
  "deepseek-v3":      "gpt-5-mini",   // DeepSeek-V3 (proxied)
  "llama-3-3-70b":    "gpt-5-nano",   // Llama 3.3 70B (proxied)
};

// Paid models: user supplies their own API key
const PAID_MODEL_BASES: Record<string, { baseURL: string; model: string }> = {
  "gpt-4o":           { baseURL: "https://api.openai.com/v1",                                   model: "gpt-4o" },
  "claude-3-5-sonnet":{ baseURL: "https://api.anthropic.com/v1",                                model: "claude-3-5-sonnet-20241022" },
  "gemini-1-5-pro":   { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",     model: "gemini-1.5-pro" },
  "deepseek-r1":      { baseURL: "https://api.deepseek.com/v1",                                 model: "deepseek-reasoner" },
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
    "Discover":          "FF2563EB",
    "Prepare":           "FF16A34A",
    "Explore":           "FFD97706",
    "Realize - Develop": "FFB45309",
    "Realize - UAT":     "FFB91C1C",
    "Deploy":            "FF0F766E",
    "Run":               "FF7C3AED",
  };
  const PHASE_LIGHT: Record<string, string> = {
    "Discover":          "FFBFDBFE",
    "Prepare":           "FFBBF7D0",
    "Explore":           "FFFDE68A",
    "Realize - Develop": "FFFEF3C7",
    "Realize - UAT":     "FFFECACA",
    "Deploy":            "FF99F6E4",
    "Run":               "FFDDD6FE",
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

  // ── Footer disclaimer row ──
  gantt.mergeCells(dataRow, 1, dataRow, FIXED + totalWeeks);
  const footCell = gantt.getCell(dataRow, 1);
  footCell.value = `© 3B Michimap  |  Transition: ${pathLabel}  |  Model: ${aiModel}  |  Total: ${totalWeeks} weeks  |  Estimates are indicative and for pre-sales guidance only.`;
  footCell.font  = { italic: true, size: 7, color: { argb: "FF888888" } };
  footCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F0E8" } };
  footCell.alignment = { horizontal: "center", vertical: "middle" };
  gantt.getRow(dataRow).height = 14;

  // ────────────────────────────────────────────────
  // SHEET 2 - Resource Planning Matrix (week columns)
  // ────────────────────────────────────────────────
  const pivot = wb.addWorksheet("Resource Planning Matrix", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    views: [{ state: "frozen", xSplit: 5, ySplit: 4 }],
  });

  // Helper: column index → Excel letter (A, B, ... Z, AA, ...)
  const colToLetter = (col: number): string => {
    let letter = "";
    let c = col;
    while (c > 0) {
      c--;
      letter = String.fromCharCode(65 + (c % 26)) + letter;
      c = Math.floor(c / 26);
    }
    return letter;
  };

  // Fixed cols: No(1) Role(2) Description(3) Location(4) Level(5)
  const FIXED_P = 5;
  const TOTAL_COL = FIXED_P + totalWeeks + 1;

  // Build year-range columns (one column per calendar year the project spans)
  interface YearRange { year: number; firstWeek: number; lastWeek: number; col: number; }
  const YEAR_RANGES: YearRange[] = [];
  {
    const sy = startDate.getFullYear();
    const ey = new Date(startDate.getTime() + totalWeeks * 7 * 24 * 60 * 60 * 1000).getFullYear();
    let yOff = 1;
    for (let y = sy; y <= ey; y++) {
      const wks: number[] = [];
      for (let w = 1; w <= totalWeeks; w++) {
        if (new Date(startDate.getTime() + (w - 1) * 7 * 24 * 60 * 60 * 1000).getFullYear() === y) wks.push(w);
      }
      if (wks.length) YEAR_RANGES.push({ year: y, firstWeek: wks[0], lastWeek: wks[wks.length - 1], col: TOTAL_COL + yOff++ });
    }
  }
  const pivotTotalCols = TOTAL_COL;

  pivot.getColumn(1).width = 4;
  pivot.getColumn(2).width = 28;
  pivot.getColumn(3).width = 15;
  pivot.getColumn(4).width = 12;
  pivot.getColumn(5).width = 15;
  for (let w = 1; w <= totalWeeks; w++) pivot.getColumn(FIXED_P + w).width = 4;
  pivot.getColumn(TOTAL_COL).width = 10;

  // Build week → phase lookup
  const weekPhase: string[] = new Array(totalWeeks + 1).fill("");
  for (const ph of plan.phases as any[]) {
    for (let w = ph.weekStart + 1; w <= ph.weekStart + ph.weeks; w++) {
      weekPhase[w] = ph.name;
    }
  }

  function pCell(row: number, col: number, value: any, opts?: {
    bg?: string; fontColor?: string; bold?: boolean; size?: number;
    hAlign?: string; italic?: boolean; numFmt?: string; wrapText?: boolean;
    borderRight?: string; borderBottom?: string;
  }) {
    const cell = pivot.getCell(row, col);
    cell.value = value;
    cell.font  = { bold: opts?.bold ?? false, italic: opts?.italic ?? false, size: opts?.size ?? 9,
                   color: { argb: opts?.fontColor ?? "FF1A1A1A" } };
    if (opts?.bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.bg } };
    cell.alignment = { horizontal: (opts?.hAlign as any) ?? "center", vertical: "middle",
                       wrapText: opts?.wrapText ?? false };
    const br = opts?.borderRight ?? "hair";
    const bb = opts?.borderBottom ?? "hair";
    cell.border = {
      right:  { style: br as any, color: { argb: "FFCCCCCC" } },
      bottom: { style: bb as any, color: { argb: "FFCCCCCC" } },
    };
    if (opts?.numFmt) cell.numFmt = opts.numFmt;
    return cell;
  }

  // ── Row 1: Title ──
  pivot.mergeCells(1, 1, 1, pivotTotalCols);
  const rmt = pivot.getCell(1, 1);
  rmt.value = `Resource Planning Matrix  -  3B Michimap`;
  rmt.font  = { bold: true, size: 13, color: { argb: WHITE } };
  rmt.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
  rmt.alignment = { horizontal: "center", vertical: "middle" };
  pivot.getRow(1).height = 28;

  // ── Row 2: Subtitle ──
  pivot.mergeCells(2, 1, 2, pivotTotalCols);
  const rms = pivot.getCell(2, 1);
  rms.value = `Transition: ${pathLabel}  |  Total: ${totalWeeks} weeks  |  Model: ${aiModel}  |  Generated: ${genDate}  |  For internal pre-sales use only`;
  rms.font  = { italic: true, size: 8, color: { argb: "FF555555" } };
  rms.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F0E8" } };
  rms.alignment = { horizontal: "center", vertical: "middle" };
  pivot.getRow(2).height = 16;

  // ── Row 3: Phase colour band (spans week columns) ──
  for (let c = 1; c <= FIXED_P; c++) {
    const fc = pivot.getCell(3, c);
    fc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D2D2D" } };
  }
  let bandCol = FIXED_P + 1;
  for (const ph of plan.phases as any[]) {
    const bandEnd = bandCol + ph.weeks - 1;
    if (ph.weeks > 1) pivot.mergeCells(3, bandCol, 3, bandEnd);
    const bc = pivot.getCell(3, bandCol);
    bc.value = ph.name;
    bc.font  = { bold: true, size: 8, color: { argb: WHITE } };
    bc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: PHASE_SOLID[ph.name] || "FF888888" } };
    bc.alignment = { horizontal: "center", vertical: "middle" };
    bandCol = bandEnd + 1;
  }
  // Total header col (row 3)
  const rtc = pivot.getCell(3, TOTAL_COL);
  rtc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D7A4F" } };
  pivot.getRow(3).height = 18;

  // ── Row 4: Column headers (No, Role, Description, Location, Level, W1…Wn, Total) ──
  pCell(4, 1, "No",          { bg: DARK_BG, fontColor: WHITE, bold: true, size: 9 });
  pCell(4, 2, "Role",        { bg: DARK_BG, fontColor: WHITE, bold: true, size: 9, hAlign: "left" });
  pCell(4, 3, "Description", { bg: DARK_BG, fontColor: WHITE, bold: true, size: 9 });
  pCell(4, 4, "Location",    { bg: DARK_BG, fontColor: WHITE, bold: true, size: 9 });
  pCell(4, 5, "Level",       { bg: DARK_BG, fontColor: WHITE, bold: true, size: 9 });
  for (let w = 1; w <= totalWeeks; w++) {
    const phName = weekPhase[w];
    const bg = PHASE_SOLID[phName] || "FF444444";
    pCell(4, FIXED_P + w, `W${w}`, { bg, fontColor: WHITE, bold: true, size: 7 });
  }
  pCell(4, TOTAL_COL, "Total Days", { bg: "FF2D7A4F", fontColor: WHITE, bold: true, size: 9 });
  pivot.getRow(4).height = 24;

  // ── Resource rows ──
  // Derive category from level (used for "Summary by Category" pivot)
  const levelToCategory: Record<string, string> = {
    "Solution Architect":      "Functional",
    "Senior Consultant":       "Functional",
    "Junior Consultant":       "Technical",
    "Project Manager":         "Governance",
    "Service Delivery Manager":"Governance",
    "Functional Consultant":   "Functional",
    "AI Consultant":           "AI",
  };

  // Use real user data when available, otherwise fall back to template
  const DEFAULT_RES = [
    { role: "Solution Architect",           desc: "Functional",  loc: "Onsite",   level: "Solution Architect",       weekEfforts: {} as Record<number,number> },
    { role: "SAP Functional Consultant",    desc: "Functional",  loc: "Onsite",   level: "Senior Consultant",        weekEfforts: {} },
    { role: "SAP Functional Consultant",    desc: "Functional",  loc: "Offshore", level: "Senior Consultant",        weekEfforts: {} },
    { role: "SAP Functional Consultant",    desc: "Functional",  loc: "Offshore", level: "Junior Consultant",        weekEfforts: {} },
    { role: "SAP Technical Consultant",     desc: "Technical",   loc: "Offshore", level: "Senior Consultant",        weekEfforts: {} },
    { role: "ABAP / BTP Developer",         desc: "Technical",   loc: "Offshore", level: "Junior Consultant",        weekEfforts: {} },
    { role: "Integration Developer (CPI)",  desc: "Technical",   loc: "Offshore", level: "Senior Consultant",        weekEfforts: {} },
    { role: "SAP Basis Administrator",      desc: "Platform",    loc: "Offshore", level: "Senior Consultant",        weekEfforts: {} },
    { role: "Security Consultant",          desc: "Technical",   loc: "Onsite",   level: "Senior Consultant",        weekEfforts: {} },
    { role: "Project Manager",              desc: "Governance",  loc: "Onsite",   level: "Project Manager",          weekEfforts: {} },
    { role: "Service Delivery Manager",     desc: "Governance",  loc: "Onsite",   level: "Service Delivery Manager", weekEfforts: {} },
    { role: "Change Management Lead",       desc: "Governance",  loc: "Onsite",   level: "Senior Consultant",        weekEfforts: {} },
    { role: "QA / Test Lead",               desc: "Quality",     loc: "Onsite",   level: "Senior Consultant",        weekEfforts: {} },
    { role: "Infra / Cloud Engineer",       desc: "Platform",    loc: "Offshore", level: "Senior Consultant",        weekEfforts: {} },
    { role: "AI / Analytics Consultant",    desc: "AI",          loc: "Offshore", level: "AI Consultant",            weekEfforts: {} },
  ];

  const RESOURCES: { role: string; desc: string; loc: string; level: string; weekEfforts: Record<number,number> }[] =
    resourceRows && resourceRows.length > 0
      ? resourceRows.map(r => ({ role: r.role, desc: levelToCategory[r.level] || "Functional", loc: r.location, level: r.level, weekEfforts: r.weekEfforts }))
      : DEFAULT_RES;

  const DATA_START = 5;
  const NUM_ROWS   = RESOURCES.length;

  for (let i = 0; i < NUM_ROWS; i++) {
    const rowNum = DATA_START + i;
    const res    = RESOURCES[i];
    const rowBg  = i % 2 === 0 ? WHITE : GREY_LIGHT;
    pivot.getRow(rowNum).height = 17;

    // Fixed label cells
    pCell(rowNum, 1, i + 1, { bg: rowBg });
    pCell(rowNum, 2, res.role,  { bg: rowBg, hAlign: "left" });
    pCell(rowNum, 3, res.desc,  { bg: rowBg });
    pCell(rowNum, 4, res.loc,   { bg: rowBg });
    pCell(rowNum, 5, res.level, { bg: rowBg });

    // Week effort cells — use actual values if user provided them, otherwise 0
    for (let w = 1; w <= totalWeeks; w++) {
      const phName  = weekPhase[w];
      const cellBg  = PHASE_LIGHT[phName] || GREY_LIGHT;
      const effortVal = res.weekEfforts[w] ?? 0;
      const wCell   = pivot.getCell(rowNum, FIXED_P + w);
      wCell.value   = effortVal;
      wCell.font    = { size: 8, color: { argb: effortVal > 0 ? "FF0D6E3B" : "FF333333" } };
      wCell.fill    = { type: "pattern", pattern: "solid", fgColor: { argb: cellBg } };
      wCell.alignment = { horizontal: "center", vertical: "middle" };
      wCell.numFmt  = "0.#";
      wCell.border  = {
        right:  { style: "hair", color: { argb: "FFBBBBBB" } },
        bottom: { style: "hair", color: { argb: "FFBBBBBB" } },
      };
    }

    // Total = SUM of week columns
    const wFirst = colToLetter(FIXED_P + 1);
    const wLast  = colToLetter(FIXED_P + totalWeeks);
    const totCell = pivot.getCell(rowNum, TOTAL_COL);
    totCell.value = { formula: `SUM(${wFirst}${rowNum}:${wLast}${rowNum})` };
    totCell.font  = { bold: true, size: 9, color: { argb: "FF15803D" } };
    totCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
    totCell.alignment = { horizontal: "center", vertical: "middle" };
    totCell.numFmt = "0.#";
    totCell.border = { right: { style: "thin", color: { argb: "FF444444" } }, bottom: { style: "hair", color: { argb: "FFCCCCCC" } } };
  }

  // Dropdown validation for Location (col D) and Level (col E)
  const dropStart = `${DATA_START}`;
  const dropEnd   = `${DATA_START + NUM_ROWS - 1}`;
  pivot.dataValidations.add(`D${dropStart}:D${dropEnd}`, {
    type: "list" as any, allowBlank: true, showDropDown: false,
    formulae: ['"Onsite,Offshore"'],
  } as any);
  pivot.dataValidations.add(`E${dropStart}:E${dropEnd}`, {
    type: "list" as any, allowBlank: true, showDropDown: false,
    formulae: ['"Solution Architect,Senior Consultant,Junior Consultant,Project Manager,Service Delivery Manager,Functional Consultant,AI Consultant"'],
  } as any);

  // ── TOTAL row ──
  const totRow = DATA_START + NUM_ROWS;
  pivot.getRow(totRow).height = 20;
  pivot.mergeCells(totRow, 1, totRow, FIXED_P);
  const trLabel = pivot.getCell(totRow, 1);
  trLabel.value = "TOTAL";
  trLabel.font  = { bold: true, size: 10, color: { argb: WHITE } };
  trLabel.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
  trLabel.alignment = { horizontal: "center", vertical: "middle" };

  for (let w = 1; w <= totalWeeks; w++) {
    const colLet = colToLetter(FIXED_P + w);
    const tc = pivot.getCell(totRow, FIXED_P + w);
    tc.value = { formula: `SUM(${colLet}${DATA_START}:${colLet}${DATA_START + NUM_ROWS - 1})` };
    tc.font  = { bold: true, size: 9, color: { argb: WHITE } };
    tc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    tc.alignment = { horizontal: "center", vertical: "middle" };
    tc.numFmt = "0";
  }
  const grandLet  = colToLetter(TOTAL_COL);
  const grandCell = pivot.getCell(totRow, TOTAL_COL);
  grandCell.value = { formula: `SUM(${grandLet}${DATA_START}:${grandLet}${DATA_START + NUM_ROWS - 1})` };
  grandCell.font  = { bold: true, size: 10, color: { argb: WHITE } };
  grandCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D7A4F" } };
  grandCell.alignment = { horizontal: "center", vertical: "middle" };
  grandCell.numFmt = "0";

  // ── Location x Level x Year Effort Pivot ──
  const LOC_GAP = totRow + 2;

  const LOC_COMBOS: { loc: string; level: string }[] = [
    { loc: "Onsite",   level: "Solution Architect"       },
    { loc: "Onsite",   level: "Senior Consultant"        },
    { loc: "Onsite",   level: "Project Manager"          },
    { loc: "Onsite",   level: "Service Delivery Manager" },
    { loc: "Offshore", level: "Senior Consultant"        },
    { loc: "Offshore", level: "Junior Consultant"        },
  ];

  // Number of year columns
  const yearCount = YEAR_RANGES.length;
  // Columns: Location(1) | Level(2) | Year...(3..3+yearCount-1) | Total(3+yearCount)
  const LC_TOTAL_COL = 3 + yearCount;
  const LC_COLS = 3 + yearCount;  // total cols in this pivot

  // Title row
  pivot.mergeCells(LOC_GAP, 1, LOC_GAP, LC_COLS);
  const lch = pivot.getCell(LOC_GAP, 1);
  lch.value = "Effort Summary by Location & Level";
  lch.font  = { bold: true, size: 9, color: { argb: WHITE } };
  lch.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
  lch.alignment = { horizontal: "center", vertical: "middle" };
  pivot.getRow(LOC_GAP).height = 18;

  // Header row
  const LC_HDR = LOC_GAP + 1;
  pivot.getRow(LC_HDR).height = 16;
  const lcHdrs = ["Location", "Level", ...YEAR_RANGES.map(y => String(y.year)), "Total Days"];
  lcHdrs.forEach((h, i) => {
    const sc = pivot.getCell(LC_HDR, 1 + i);
    sc.value = h;
    sc.font  = { bold: true, size: 8, color: { argb: WHITE } };
    sc.fill  = { type: "pattern", pattern: "solid",
                 fgColor: { argb: i >= 2 && i < 2 + yearCount ? "FF374151" : DARK_BG } };
    sc.alignment = { horizontal: "center", vertical: "middle" };
    sc.border = { right: { style: "thin", color: { argb: "FF444444" } }, bottom: { style: "thin", color: { argb: "FF444444" } } };
  });

  // Helper: build a single-column row-sum expression for a range of weeks.
  // e.g. weekRowSum(1, 3) => "F5:F24+G5:G24+H5:H24"
  // This collapses multi-column week data into a 20-row column array so that
  // SUMPRODUCT can filter it with single-column criteria arrays without #VALUE!
  const weekRowSum = (firstW: number, lastW: number): string => {
    const terms: string[] = [];
    for (let w = firstW; w <= lastW; w++) {
      const col = colToLetter(FIXED_P + w);
      terms.push(`${col}${DATA_START}:${col}${DATA_START + NUM_ROWS - 1}`);
    }
    return terms.join("+");
  };

  const locArr = `$D$${DATA_START}:$D$${DATA_START + NUM_ROWS - 1}`;
  const levArr = `$E$${DATA_START}:$E$${DATA_START + NUM_ROWS - 1}`;
  const allWeeksExpr = weekRowSum(1, totalWeeks);

  let prevLoc = "";
  LOC_COMBOS.forEach(({ loc, level }, i) => {
    const rn  = LC_HDR + 1 + i;
    const bg  = i % 2 === 0 ? WHITE : GREY_LIGHT;
    pivot.getRow(rn).height = 15;

    // Location cell — only on first row for that location
    const locCell = pivot.getCell(rn, 1);
    if (loc !== prevLoc) {
      locCell.value = loc;
      locCell.font  = { bold: true, size: 8 };
    }
    locCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    locCell.alignment = { horizontal: "center", vertical: "middle" };
    locCell.border = { right: { style: "hair", color: { argb: "FFCCCCCC" } }, bottom: { style: "hair", color: { argb: "FFCCCCCC" } } };
    prevLoc = loc;

    // Level cell
    const levCell = pivot.getCell(rn, 2);
    levCell.value = level;
    levCell.font  = { size: 8 };
    levCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    levCell.alignment = { horizontal: "left", vertical: "middle" };
    levCell.border = { right: { style: "hair", color: { argb: "FFCCCCCC" } }, bottom: { style: "hair", color: { argb: "FFCCCCCC" } } };

    // Per-year columns — SUMPRODUCT with collapsed row-sum (no multi-col SUMIFS)
    YEAR_RANGES.forEach((yr, yi) => {
      const yrExpr = weekRowSum(yr.firstWeek, yr.lastWeek);
      const yc = pivot.getCell(rn, 3 + yi);
      yc.value = { formula: `SUMPRODUCT((${locArr}="${loc}")*(${levArr}="${level}")*(${yrExpr}))` };
      yc.font  = { size: 8 };
      yc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      yc.alignment = { horizontal: "center", vertical: "middle" };
      yc.numFmt = "0";
      yc.border = { right: { style: "hair", color: { argb: "FFCCCCCC" } }, bottom: { style: "hair", color: { argb: "FFCCCCCC" } } };
    });

    // Total Days (all weeks)
    const tc = pivot.getCell(rn, LC_TOTAL_COL);
    tc.value = { formula: `SUMPRODUCT((${locArr}="${loc}")*(${levArr}="${level}")*(${allWeeksExpr}))` };
    tc.font  = { bold: true, size: 8, color: { argb: "FF15803D" } };
    tc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    tc.alignment = { horizontal: "center", vertical: "middle" };
    tc.numFmt = "0";
    tc.border = { right: { style: "thin", color: { argb: "FF444444" } }, bottom: { style: "hair", color: { argb: "FFCCCCCC" } } };
  });

  // Subtotal rows: Onsite total, Offshore total
  ["Onsite", "Offshore"].forEach((loc, si) => {
    const rn = LC_HDR + 1 + LOC_COMBOS.length + si;
    const bg = "FFEFF6FF";
    pivot.getRow(rn).height = 16;

    const stLabel = pivot.getCell(rn, 1);
    stLabel.value = `Subtotal ${loc}`;
    stLabel.font  = { bold: true, size: 8 };
    stLabel.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    stLabel.alignment = { horizontal: "left", vertical: "middle" };
    stLabel.border = { right: { style: "hair", color: { argb: "FFCCCCCC" } }, bottom: { style: "thin", color: { argb: "FF444444" } } };
    pivot.getCell(rn, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };

    YEAR_RANGES.forEach((yr, yi) => {
      const yrExpr = weekRowSum(yr.firstWeek, yr.lastWeek);
      const yc = pivot.getCell(rn, 3 + yi);
      yc.value = { formula: `SUMPRODUCT((${locArr}="${loc}")*(${yrExpr}))` };
      yc.font  = { bold: true, size: 8 };
      yc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      yc.alignment = { horizontal: "center", vertical: "middle" };
      yc.numFmt = "0";
      yc.border = { right: { style: "hair", color: { argb: "FFCCCCCC" } }, bottom: { style: "thin", color: { argb: "FF444444" } } };
    });

    const tc = pivot.getCell(rn, LC_TOTAL_COL);
    tc.value = { formula: `SUMPRODUCT((${locArr}="${loc}")*(${allWeeksExpr}))` };
    tc.font  = { bold: true, size: 8, color: { argb: "FF15803D" } };
    tc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    tc.alignment = { horizontal: "center", vertical: "middle" };
    tc.numFmt = "0";
    tc.border = { right: { style: "thin", color: { argb: "FF444444" } }, bottom: { style: "thin", color: { argb: "FF444444" } } };
  });

  // Grand total row
  const lcTotRow = LC_HDR + 1 + LOC_COMBOS.length + 2;
  pivot.getRow(lcTotRow).height = 18;
  pivot.mergeCells(lcTotRow, 1, lcTotRow, 2);
  const gtLabel = pivot.getCell(lcTotRow, 1);
  gtLabel.value = "GRAND TOTAL";
  gtLabel.font  = { bold: true, size: 9, color: { argb: WHITE } };
  gtLabel.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
  gtLabel.alignment = { horizontal: "center", vertical: "middle" };

  // Grand total per year — SUM is fine here (no row filtering needed)
  YEAR_RANGES.forEach((yr, yi) => {
    const yrExpr = weekRowSum(yr.firstWeek, yr.lastWeek);
    const yc = pivot.getCell(lcTotRow, 3 + yi);
    yc.value = { formula: `SUMPRODUCT(${yrExpr})` };
    yc.font  = { bold: true, size: 9, color: { argb: WHITE } };
    yc.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    yc.alignment = { horizontal: "center", vertical: "middle" };
    yc.numFmt = "0";
  });

  const lcGrand = pivot.getCell(lcTotRow, LC_TOTAL_COL);
  lcGrand.value = { formula: `SUMPRODUCT(${allWeeksExpr})` };
  lcGrand.font  = { bold: true, size: 9, color: { argb: WHITE } };
  lcGrand.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D7A4F" } };
  lcGrand.alignment = { horizontal: "center", vertical: "middle" };
  lcGrand.numFmt = "0";

  // Column widths for the pivot table area
  pivot.getColumn(1).width = 16;
  pivot.getColumn(2).width = 18;
  YEAR_RANGES.forEach((_, yi) => { pivot.getColumn(3 + yi).width = 12; });
  pivot.getColumn(LC_TOTAL_COL).width = 12;

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
