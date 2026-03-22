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
    
    const freeModelId = FREE_MODEL_MAP[params.aiModel];
    const paidModelBase = PAID_MODEL_BASES[params.aiModel];

    let model = "gpt-5-nano";
    if (freeModelId) {
      model = freeModelId;
    } else if (paidModelBase && params.apiKey) {
      client = new OpenAI({ apiKey: params.apiKey, baseURL: paidModelBase.baseURL });
      model = paidModelBase.model;
    }

    const prompt = `You are an SAP S/4HANA implementation expert. The user has selected a ${params.transitionPath} transition path with ${params.phases.realizeDevelop.weeks} weeks for Realize-Develop.

Based on this, provide a brief executive summary (2-3 sentences) for this project plan. Keep it professional and specific to ${params.transitionPath} implementation.

Return ONLY a JSON object with one field: {"summary": "your summary here"}`;

    const response = await client.chat.completions.create({
      model,
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

// ─────────────────────────────────────────────────────────────────────────────
// Excel workbook builder  (Gantt + Resource Pivot)
// ─────────────────────────────────────────────────────────────────────────────

async function buildExcelWorkbook(plan: any, aiModel: string, recipientEmail?: string, recipientName?: string) {
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
  // SHEET 1 — Project Plan (Gantt)
  // ────────────────────────────────────────────────
  const gantt = wb.addWorksheet("Project Plan", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    views: [{ state: "frozen", xSplit: 3, ySplit: 5 }],
  });

  const FIXED = 3; // Phase | Activity | Responsible

  // Set column widths
  gantt.getColumn(1).width = 16;
  gantt.getColumn(2).width = 34;
  gantt.getColumn(3).width = 20;
  for (let w = 1; w <= totalWeeks; w++) gantt.getColumn(FIXED + w).width = 3.6;

  // ── Row 1: Main Title ──
  gantt.mergeCells(1, 1, 1, FIXED + totalWeeks);
  const titleCell = gantt.getCell(1, 1);
  titleCell.value = `3B Michimap  —  SAP S/4HANA Pre-Sales Plan  (${pathLabel})`;
  titleCell.font  = { bold: true, size: 14, color: { argb: WHITE }, name: "Calibri" };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  gantt.getRow(1).height = 28;

  // ── Row 2: Liner / Disclaimer ──
  gantt.mergeCells(2, 1, 2, FIXED + totalWeeks);
  const linerCell = gantt.getCell(2, 1);
  linerCell.value = `Generated by 3B Michimap using ${aiModel}  |  ${genDate}  |  For internal pre-sales use only — not for client distribution. Estimates are indicative.`;
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

  // ── Row 4: Week numbers ──
  for (let c = 1; c <= FIXED; c++) {
    gantt.getCell(4, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D2D2D" } };
  }
  for (let w = 1; w <= totalWeeks; w++) {
    const c = gantt.getCell(4, FIXED + w);
    c.value = `W${w}`;
    c.font  = { bold: true, size: 7, color: { argb: WHITE } };
    c.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D2D2D" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  }
  gantt.getRow(4).height = 14;

  // ── Row 5: Calendar dates + column headers ──
  const hdrLabels = ["Phase", "Activity", "Responsible"];
  for (let c = 1; c <= FIXED; c++) {
    const cell = gantt.getCell(5, c);
    cell.value = hdrLabels[c - 1];
    cell.font  = { bold: true, size: 9, color: { argb: WHITE } };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { right: { style: "thin", color: { argb: "FF444444" } } };
  }
  for (let w = 1; w <= totalWeeks; w++) {
    const weekDate = new Date(startDate.getTime() + (w - 1) * 7 * 24 * 60 * 60 * 1000);
    const dateStr  = weekDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const c = gantt.getCell(5, FIXED + w);
    c.value = dateStr;
    c.font  = { size: 7, color: { argb: "FF333333" } };
    c.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: GREY_LIGHT } };
    c.alignment = { horizontal: "center", vertical: "middle", textRotation: 90 };
    c.border   = { right: { style: "hair", color: { argb: GREY_MID } }, bottom: { style: "thin", color: { argb: GREY_MID } } };
  }
  gantt.getRow(5).height = 48;

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
      respCell.border    = { right: { style: "thin", color: { argb: "FF444444" } }, bottom: { style: "hair", color: { argb: GREY_MID } } };

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
  // SHEET 2 — Resource Pivot
  // ────────────────────────────────────────────────
  const pivot = wb.addWorksheet("Resource Pivot", {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });

  // Determine year columns
  const startYear = startDate.getFullYear();
  const endYear   = new Date(startDate.getTime() + totalWeeks * 7 * 24 * 60 * 60 * 1000).getFullYear();
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  // Column widths: No | Role | Description | Location | Level | [years] | Total
  pivot.getColumn(1).width = 5;
  pivot.getColumn(2).width = 30;
  pivot.getColumn(3).width = 16;
  pivot.getColumn(4).width = 12;
  pivot.getColumn(5).width = 16;
  for (let i = 0; i < years.length; i++) pivot.getColumn(6 + i).width = 10;
  pivot.getColumn(6 + years.length).width = 10;

  const totalCols = 5 + years.length + 1; // No+Role+Desc+Loc+Level + years + Total

  function pivotHeaderCell(row: number, col: number, value: string, opts?: { bg?: string; fontColor?: string; bold?: boolean; size?: number; hAlign?: string }) {
    const cell = pivot.getCell(row, col);
    cell.value = value;
    cell.font  = { bold: opts?.bold ?? true, size: opts?.size ?? 9, color: { argb: opts?.fontColor ?? WHITE } };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: opts?.bg ?? DARK_BG } };
    cell.alignment = { horizontal: (opts?.hAlign as any) ?? "center", vertical: "middle", wrapText: true };
    cell.border = { top: { style: "thin", color: { argb: "FF444444" } }, bottom: { style: "thin", color: { argb: "FF444444" } }, right: { style: "thin", color: { argb: "FF444444" } }, left: { style: "thin", color: { argb: "FF444444" } } };
    return cell;
  }

  // Row 1: Title
  pivot.mergeCells(1, 1, 1, totalCols);
  const pTitleCell = pivot.getCell(1, 1);
  pTitleCell.value = `Resource Effort Pivot by Year`;
  pTitleCell.font  = { bold: true, size: 13, color: { argb: WHITE } };
  pTitleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
  pTitleCell.alignment = { horizontal: "center", vertical: "middle" };
  pivot.getRow(1).height = 26;

  // Row 2: Subtitle
  pivot.mergeCells(2, 1, 2, totalCols);
  const pSubCell = pivot.getCell(2, 1);
  pSubCell.value = `Transition: ${pathLabel}  |  Total Weeks: ${totalWeeks}  |  Model: ${aiModel}`;
  pSubCell.font  = { italic: true, size: 8, color: { argb: "FF444444" } };
  pSubCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F0E8" } };
  pSubCell.alignment = { horizontal: "center", vertical: "middle" };
  pivot.getRow(2).height = 16;

  // Row 3: blank
  pivot.getRow(3).height = 6;

  // Row 4: Column headers
  const hdrRow = 4;
  pivot.getRow(hdrRow).height = 30;
  pivotHeaderCell(hdrRow, 1, "No");
  pivotHeaderCell(hdrRow, 2, "Role",        { hAlign: "left" });
  pivotHeaderCell(hdrRow, 3, "Description", { hAlign: "center" });
  pivotHeaderCell(hdrRow, 4, "Location",    { hAlign: "center" });
  pivotHeaderCell(hdrRow, 5, "Level",       { hAlign: "center" });
  years.forEach((yr, i) => pivotHeaderCell(hdrRow, 6 + i, String(yr)));
  pivotHeaderCell(hdrRow, 6 + years.length, "Total", { bg: "FF2D7A4F" });

  // Resource rows
  const RESOURCES = [
    { role: "Solution Architect",           desc: "Functional",  loc: "Onsite",   level: "Sol. Architect" },
    { role: "SAP Functional Consultant",    desc: "Functional",  loc: "Onsite",   level: "Sr" },
    { role: "SAP Functional Consultant",    desc: "Functional",  loc: "Offshore", level: "Sr" },
    { role: "SAP Functional Consultant",    desc: "Functional",  loc: "Offshore", level: "Jr" },
    { role: "SAP Technical Consultant",     desc: "Technical",   loc: "Offshore", level: "Sr" },
    { role: "ABAP / BTP Developer",         desc: "Technical",   loc: "Offshore", level: "Jr" },
    { role: "Integration Developer (CPI)",  desc: "Technical",   loc: "Offshore", level: "Sr" },
    { role: "SAP Basis Administrator",      desc: "Platform",    loc: "Offshore", level: "Sr" },
    { role: "Security Consultant",          desc: "Technical",   loc: "Onsite",   level: "Sr" },
    { role: "Project Manager",              desc: "Governance",  loc: "Onsite",   level: "PM" },
    { role: "Service Delivery Manager",     desc: "Governance",  loc: "Onsite",   level: "SDM" },
    { role: "Change Management Lead",       desc: "Governance",  loc: "Onsite",   level: "Sr" },
    { role: "QA / Test Lead",               desc: "Quality",     loc: "Onsite",   level: "Sr" },
    { role: "Infra / Cloud Engineer",       desc: "Platform",    loc: "Offshore", level: "Sr" },
    { role: "AI / Analytics Consultant",    desc: "AI",          loc: "Offshore", level: "Sr" },
  ];

  const dataStartRow = 5;

  const colToLetter = (col: number): string => {
    let letter = "";
    while (col > 0) {
      col--;
      letter = String.fromCharCode(65 + (col % 26)) + letter;
      col = Math.floor(col / 26);
    }
    return letter;
  };

  for (let i = 0; i < 20; i++) {
    const rowNum = dataStartRow + i;
    const res = RESOURCES[i] as any;
    const isEven = i % 2 === 0;
    const rowBg = isEven ? WHITE : GREY_LIGHT;
    pivot.getRow(rowNum).height = 18;

    const setDataCell = (col: number, value: any, opts?: { bold?: boolean; color?: string; hAlign?: string; numFmt?: string }) => {
      const cell = pivot.getCell(rowNum, col);
      cell.value = value;
      cell.font  = { size: 9, bold: opts?.bold ?? false, color: { argb: opts?.color ?? "FF1A1A1A" } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
      cell.alignment = { horizontal: (opts?.hAlign as any) ?? "center", vertical: "middle" };
      cell.border = { bottom: { style: "hair", color: { argb: GREY_MID } }, right: { style: "hair", color: { argb: GREY_MID } } };
      if (opts?.numFmt) cell.numFmt = opts.numFmt;
      return cell;
    };

    setDataCell(1, res ? i + 1 : "");
    setDataCell(2, res ? res.role : "",        { hAlign: "left" });
    setDataCell(3, res ? res.desc : "");
    setDataCell(4, res ? res.loc : "");
    setDataCell(5, res ? res.level : "");

    for (let yi = 0; yi < years.length; yi++) {
      setDataCell(6 + yi, res ? 0 : "", { hAlign: "center", numFmt: "0" });
    }

    // Total col — sum of year cols
    const firstYrCol = colToLetter(6);
    const lastYrCol  = colToLetter(5 + years.length);
    const totalCell = pivot.getCell(rowNum, 6 + years.length);
    totalCell.value = res
      ? { formula: `SUM(${firstYrCol}${rowNum}:${lastYrCol}${rowNum})` }
      : "";
    totalCell.font  = { bold: true, size: 9, color: { argb: "FF15803D" } };
    totalCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
    totalCell.alignment = { horizontal: "center", vertical: "middle" };
    totalCell.numFmt = "0";
    totalCell.border = { bottom: { style: "hair", color: { argb: GREY_MID } }, right: { style: "thin", color: { argb: "FF444444" } } };
  }

  // TOTAL row
  const totalRowNum = dataStartRow + 20;
  pivot.getRow(totalRowNum).height = 20;
  pivot.mergeCells(totalRowNum, 1, totalRowNum, 5);
  const totLblCell = pivot.getCell(totalRowNum, 1);
  totLblCell.value = "TOTAL";
  totLblCell.font  = { bold: true, size: 10, color: { argb: WHITE } };
  totLblCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
  totLblCell.alignment = { horizontal: "center", vertical: "middle" };

  for (let yi = 0; yi < years.length; yi++) {
    const col = 6 + yi;
    const letter = colToLetter(col);
    const cell = pivot.getCell(totalRowNum, col);
    cell.value = { formula: `SUM(${letter}${dataStartRow}:${letter}${dataStartRow + 19})` };
    cell.font  = { bold: true, size: 10, color: { argb: WHITE } };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.numFmt = "0";
  }
  const totColLetter = colToLetter(6 + years.length);
  const grandTotCell = pivot.getCell(totalRowNum, 6 + years.length);
  grandTotCell.value = { formula: `SUM(${totColLetter}${dataStartRow}:${totColLetter}${dataStartRow + 19})` };
  grandTotCell.font  = { bold: true, size: 10, color: { argb: WHITE } };
  grandTotCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D7A4F" } };
  grandTotCell.alignment = { horizontal: "center", vertical: "middle" };
  grandTotCell.numFmt = "0";

  // Gap
  const gapRow = totalRowNum + 2;

  // ── Summary by Level ──
  const lvlStartRow = gapRow;
  pivot.mergeCells(lvlStartRow, 1, lvlStartRow, 5 + years.length);
  const lvlHdrCell = pivot.getCell(lvlStartRow, 1);
  lvlHdrCell.value = "Summary by Level";
  lvlHdrCell.font  = { bold: true, size: 9, color: { argb: WHITE } };
  lvlHdrCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
  lvlHdrCell.alignment = { horizontal: "center", vertical: "middle" };
  pivot.getRow(lvlStartRow).height = 18;

  // Level header row
  const lvlColHdrRow = lvlStartRow + 1;
  pivot.getRow(lvlColHdrRow).height = 16;
  ["Level", "Description", ...years.map(y => String(y)), "Total"].forEach((lbl, i) => {
    pivotHeaderCell(lvlColHdrRow, 1 + i, lbl);
  });

  const LEVELS = [
    { key: "Jr",            label: "Junior" },
    { key: "Sr",            label: "Senior" },
    { key: "Sol. Architect",label: "Solution Architect" },
    { key: "PM",            label: "Project Manager" },
    { key: "SDM",           label: "Service Delivery Manager" },
  ];

  const levelDataStart = lvlColHdrRow + 1;
  const levelCol = colToLetter(5); // Level is col E

  LEVELS.forEach(({ key, label }, i) => {
    const rn = levelDataStart + i;
    pivot.getRow(rn).height = 16;
    const bg = i % 2 === 0 ? WHITE : GREY_LIGHT;
    const setL = (col: number, value: any, color?: string) => {
      const cell = pivot.getCell(rn, col);
      cell.value = value;
      cell.font  = { size: 9, bold: !!color, color: { argb: color ?? "FF1A1A1A" } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { horizontal: "left", vertical: "middle" };
      cell.border = { bottom: { style: "hair", color: { argb: GREY_MID } }, right: { style: "hair", color: { argb: GREY_MID } } };
    };
    setL(1, key);
    setL(2, label);
    for (let yi = 0; yi < years.length; yi++) {
      const yrCol = colToLetter(6 + yi);
      const cell = pivot.getCell(rn, 3 + yi);
      cell.value = { formula: `SUMIF(${levelCol}${dataStartRow}:${levelCol}${dataStartRow + 19},"${key}",${yrCol}${dataStartRow}:${yrCol}${dataStartRow + 19})` };
      cell.font  = { size: 9 };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.numFmt = "0";
    }
    const totC = pivot.getCell(rn, 3 + years.length);
    const firstC = colToLetter(3);
    const lastC  = colToLetter(2 + years.length);
    totC.value = { formula: `SUM(${firstC}${rn}:${lastC}${rn})` };
    totC.font  = { bold: true, size: 9, color: { argb: "FF15803D" } };
    totC.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    totC.alignment = { horizontal: "center", vertical: "middle" };
    totC.numFmt = "0";
  });

  // ── Summary by Description ──
  const descGapRow = levelDataStart + LEVELS.length + 2;
  pivot.mergeCells(descGapRow, 1, descGapRow, 5 + years.length);
  const descHdrCell = pivot.getCell(descGapRow, 1);
  descHdrCell.value = "Summary by Description";
  descHdrCell.font  = { bold: true, size: 9, color: { argb: WHITE } };
  descHdrCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
  descHdrCell.alignment = { horizontal: "center", vertical: "middle" };
  pivot.getRow(descGapRow).height = 18;

  const descColHdrRow = descGapRow + 1;
  pivot.getRow(descColHdrRow).height = 16;
  ["Category", ...years.map(y => String(y)), "Total"].forEach((lbl, i) => {
    pivotHeaderCell(descColHdrRow, 1 + i, lbl);
  });

  const DESCS = ["Functional", "Technical", "Governance", "Quality", "Platform", "AI"];
  const descCol = colToLetter(3); // Description is col C

  DESCS.forEach((cat, i) => {
    const rn = descColHdrRow + 1 + i;
    pivot.getRow(rn).height = 16;
    const bg = i % 2 === 0 ? WHITE : GREY_LIGHT;
    pivot.getCell(rn, 1).value = cat;
    pivot.getCell(rn, 1).font  = { size: 9 };
    pivot.getCell(rn, 1).fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    pivot.getCell(rn, 1).alignment = { horizontal: "left", vertical: "middle" };
    for (let yi = 0; yi < years.length; yi++) {
      const yrCol = colToLetter(6 + yi);
      const cell = pivot.getCell(rn, 2 + yi);
      cell.value = { formula: `SUMIF(${descCol}${dataStartRow}:${descCol}${dataStartRow + 19},"${cat}",${yrCol}${dataStartRow}:${yrCol}${dataStartRow + 19})` };
      cell.font  = { size: 9 };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.numFmt = "0";
    }
    const totC = pivot.getCell(rn, 2 + years.length);
    const firstC = colToLetter(2);
    const lastC  = colToLetter(1 + years.length);
    totC.value = { formula: `SUM(${firstC}${rn}:${lastC}${rn})` };
    totC.font  = { bold: true, size: 9, color: { argb: "FF15803D" } };
    totC.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    totC.alignment = { horizontal: "center", vertical: "middle" };
    totC.numFmt = "0";
  });

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
  const { planId, downloadToken } = req.body;
  const resolvedPlanId = downloadToken ? downloadTokens.get(downloadToken) : planId;
  if (!resolvedPlanId) return res.status(403).json({ error: "Invalid or expired download token" });

  const plan = planStore.get(resolvedPlanId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  try {
    const storedPlan = planStore.get(resolvedPlanId);

    const workbook = await buildExcelWorkbook(plan, plan.requestBody?.aiModel || "Gemini 2.0 Flash");

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
