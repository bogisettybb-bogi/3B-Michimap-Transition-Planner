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
      { category: "Governance", activity: "Project Governance Structure and RACI", description: "Establish project governance structure, define RACI matrix, and finalize detailed project plan with phase-wise milestones", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Stream Leads", informed: "Steering Committee", milestone: true },
      { category: "Infrastructure", activity: "System Landscape Provisioning", description: "Provision S/4HANA system landscape (DEV, QAS, PRD) and configure initial transport routes", workstream: "Technical", responsible: "Basis / Platform", accountable: "Technical Lead", consulted: "SAP Consultant", informed: "Project Manager", milestone: false },
      { category: "Infrastructure", activity: "Initial System Configuration", description: "Configure initial system settings including client setup, transport management system (TMS), and user access roles", workstream: "Technical", responsible: "Basis", accountable: "Technical Lead", consulted: "IT Security", informed: "Project Manager", milestone: false },
      { category: "Data Management", activity: "Data Migration Approach Definition", description: "Define data migration approach including object scoping, legacy system identification, and migration sequencing", workstream: "Data Management", responsible: "Technical Consultant", accountable: "Project Manager", consulted: "Business SMEs", informed: "Steering Committee", milestone: false },
      { category: "Integration", activity: "Integration Architecture Definition", description: "Define integration architecture including middleware selection and interface communication patterns for all upstream and downstream systems", workstream: "Technical", responsible: "Integration Consultant", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
    ],
    explore: [
      { category: "Fit-to-Standard", activity: "Fit-to-Standard Workshops", description: "Conduct fit-to-standard workshops in DEV system using SAP Best Practices and document delta requirements for all process areas", workstream: "Cross-Stream", responsible: "Functional Consultant", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Configuration", activity: "Baseline Configuration and Validation", description: "Configure baseline business processes in DEV system to validate standard process fitment against business requirements", workstream: "Cross-Stream", responsible: "Functional Consultant", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Design", activity: "Functional and Technical Design Documents", description: "Finalize functional and technical design documents including WRICEF object identification and sign-off", workstream: "Cross-Stream", responsible: "Functional + Technical", accountable: "Solution Architect", consulted: "Business SMEs", informed: "Project Manager", milestone: true },
      { category: "Data Management", activity: "Data Migration Object and Mapping Design", description: "Define data migration objects, field mappings, and transformation rules based on source-to-target mapping from legacy systems", workstream: "Data Management", responsible: "Technical Consultant", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Integration", activity: "Integration Interface Design Specifications", description: "Define integration interfaces, APIs, and data exchange formats for all upstream and downstream systems", workstream: "Technical", responsible: "Integration Consultant", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
    ],
    realizeDevelop: [
      { category: "Configuration", activity: "Business Process Configuration", description: "Perform detailed configuration of business processes in DEV system using IMG and transport all configuration changes to QAS", workstream: "Cross-Stream", responsible: "Functional Consultant", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Development", activity: "WRICEF Object Development", description: "Develop WRICEF objects (Reports, Interfaces, Conversions, Enhancements, Forms, Workflows) in DEV and transport to QAS", workstream: "Technical", responsible: "Technical Consultant", accountable: "Technical Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
      { category: "Data Management", activity: "Data Migration Mock Cycles", description: "Execute data migration mock cycles using Migration Cockpit from legacy systems into QAS environment and validate data quality", workstream: "Data Management", responsible: "Technical Consultant", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Integration", activity: "Integration Interface Build and Validation", description: "Build and deploy integration interfaces using middleware and validate message flows across all connected systems", workstream: "Technical", responsible: "Integration Consultant", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
      { category: "Testing", activity: "Unit Testing and System Integration Testing", description: "Execute unit testing in DEV and system integration testing (SIT) in QAS environment across all business process streams", workstream: "Quality Assurance", responsible: "Functional + Technical", accountable: "QA Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
    ],
    realizeUat: [
      { category: "UAT", activity: "User Acceptance Testing", description: "Support user acceptance testing (UAT) in QAS system and resolve identified defects to achieve business sign-off", workstream: "Quality Assurance", responsible: "Functional Consultant", accountable: "Business Sponsor", consulted: "Business Users", informed: "Steering Committee", milestone: true },
      { category: "Cutover", activity: "Cutover Planning and Rehearsal", description: "Finalize cutover plan, execute cutover rehearsals and validate go/no-go criteria with all teams", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Board", milestone: false },
      { category: "Training", activity: "End User Training Delivery", description: "Deliver role-based end-user training and confirm system access readiness for production go-live", workstream: "Change Management", responsible: "Functional Consultant", accountable: "Change Manager", consulted: "Department Heads", informed: "All Users", milestone: false },
    ],
    deploy: [
      { category: "Cutover", activity: "Cutover and Transport Execution", description: "Execute cutover plan including transport of all approved objects from QAS to PRD using a controlled release strategy", workstream: "Project Management", responsible: "Project Manager + Basis", accountable: "Project Manager", consulted: "All Teams", informed: "Organization", milestone: false },
      { category: "Data Management", activity: "Final Data Migration to Production", description: "Perform final data migration from legacy systems into PRD environment ensuring full data reconciliation and sign-off", workstream: "Data Management", responsible: "Technical Consultant", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Change Management", activity: "End-User Training and System Access", description: "Conduct final end-user training and provide system access in PRD environment ahead of go-live", workstream: "Change Management", responsible: "Functional Consultant", accountable: "Change Manager", consulted: "Department Heads", informed: "All Users", milestone: false },
      { category: "Go-Live", activity: "Go-Live and Hypercare Activation", description: "Execute go-live and provide hypercare support with real-time issue resolution in PRD to ensure stable production system", workstream: "Cross-Stream", responsible: "All", accountable: "Project Manager", consulted: "Business Sponsor", informed: "Organization", milestone: true },
    ],
    run: [
      { category: "Support", activity: "System Performance and Incident Monitoring", description: "Monitor system performance, background jobs, and interfaces in PRD environment and resolve incidents promptly", workstream: "Support", responsible: "Basis / Support", accountable: "IT Manager", consulted: "Business Users", informed: "Project Manager", milestone: false },
      { category: "Optimization", activity: "Continuous Improvements and Enhancements", description: "Perform continuous improvements including minor enhancements and transport changes across the system landscape", workstream: "Cross-Stream", responsible: "Functional + Technical", accountable: "IT Manager", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Knowledge Transfer", activity: "Knowledge Transfer to Internal Team", description: "Complete knowledge transfer documentation and formal handover to BAU support team", workstream: "Change Management", responsible: "Consultants", accountable: "Internal IT Lead", consulted: "Support Team", informed: "Management", milestone: false },
      { category: "Closure", activity: "Project Closure and Lessons Learned", description: "Formal project closure, benefits realization review and lessons learned documentation", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Board", milestone: true },
    ],
  },
  brownfield: {
    discover: [
      { category: "Assessment", activity: "Current ECC Landscape Assessment", description: "Assess existing SAP ECC landscape, custom code volume, active interfaces and data object sizes to scope the conversion effort", workstream: "Technical", responsible: "Solution Architect", accountable: "Technical Lead", consulted: "Basis Team", informed: "Project Manager", milestone: false },
      { category: "Assessment", activity: "SAP Readiness Check and Simplification Analysis", description: "Run SAP Readiness Check, analyze Simplification Items and custom code impact using SAP Custom Code Migration app", workstream: "Technical", responsible: "SAP Consultant", accountable: "Technical Lead", consulted: "ABAP Team", informed: "Project Manager", milestone: true },
      { category: "Business Case", activity: "Business Case for System Conversion", description: "Develop ROI analysis comparing system conversion against reimplementation and present to executive stakeholders", workstream: "Project Management", responsible: "SAP Consultant", accountable: "Business Sponsor", consulted: "Finance", informed: "Board", milestone: false },
    ],
    prepare: [
      { category: "Governance", activity: "Project Governance Structure and RACI", description: "Establish project governance structure, define RACI matrix, and finalize project plan with conversion milestones and downtime windows", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Stream Leads", informed: "Steering Committee", milestone: true },
      { category: "Infrastructure", activity: "Conversion Environment Setup", description: "Set up technical conversion sandbox, install SUM tool, and configure initial transport routes for DEV-QAS-PRD landscape", workstream: "Technical", responsible: "Basis / Platform", accountable: "Technical Lead", consulted: "SAP Support", informed: "Project Manager", milestone: false },
      { category: "Infrastructure", activity: "Initial System Configuration and Access", description: "Configure system settings including client parameters, transport management system (TMS), and user access roles for the project team", workstream: "Technical", responsible: "Basis", accountable: "Technical Lead", consulted: "IT Security", informed: "Project Manager", milestone: false },
      { category: "Custom Code", activity: "Custom Code Remediation Planning", description: "Plan remediation of custom ABAP objects based on Simplification Item analysis, categorize by impact and assign resolution owners", workstream: "Technical", responsible: "ABAP Lead", accountable: "Technical Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
      { category: "Integration", activity: "Integration and Interface Impact Assessment", description: "Identify all existing interfaces and assess modifications required to align with S/4HANA APIs and data models", workstream: "Technical", responsible: "Integration Consultant", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
    ],
    explore: [
      { category: "Delta Design", activity: "Delta Design for Finance Processes", description: "Design S/4HANA delta changes for Finance: universal journal migration, asset accounting changes and new FI reporting structures", workstream: "Finance", responsible: "Finance Consultant", accountable: "Finance Lead", consulted: "Finance Team", informed: "CFO", milestone: false },
      { category: "Delta Design", activity: "Delta Design for Logistics and Operations", description: "Design S/4HANA delta changes for MM, SD, PP and WM including new table structures and changed business functions", workstream: "Operations", responsible: "Functional Consultant", accountable: "Operations Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Design", activity: "Functional and Technical Design Documents", description: "Finalize functional design for all delta changes and technical design for WRICEF objects requiring remediation or replacement", workstream: "Cross-Stream", responsible: "Functional + Technical", accountable: "Solution Architect", consulted: "Business SMEs", informed: "Project Manager", milestone: true },
      { category: "Data Management", activity: "Data Migration Object and Mapping Design", description: "Identify open items and balances requiring migration or data cleansing during conversion and define reconciliation approach", workstream: "Data Management", responsible: "Technical Consultant", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Integration", activity: "Integration Interface Redesign Specifications", description: "Define updated interface specifications and API designs for all upstream and downstream systems impacted by S/4HANA conversion", workstream: "Technical", responsible: "Integration Consultant", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
    ],
    realizeDevelop: [
      { category: "Configuration", activity: "S/4HANA Delta Configuration", description: "Perform detailed delta configuration in DEV system for all process areas and transport configuration changes to QAS", workstream: "Cross-Stream", responsible: "Functional Consultant", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Development", activity: "Custom Code Remediation and WRICEF Development", description: "Remediate custom ABAP objects affected by simplifications and develop new WRICEF objects to replace retired custom code", workstream: "Technical", responsible: "Technical Consultant", accountable: "Technical Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
      { category: "Conversion", activity: "Trial System Conversion Runs", description: "Execute multiple trial system conversions using SUM, measure conversion downtime and validate technical migration consistency", workstream: "Technical", responsible: "Basis / Platform", accountable: "Technical Lead", consulted: "ABAP Team", informed: "Project Manager", milestone: false },
      { category: "Integration", activity: "Interface Adaptation and End-to-End Validation", description: "Adapt existing interfaces to S/4HANA APIs and validate all inbound and outbound message flows across connected systems", workstream: "Technical", responsible: "Integration Consultant", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
      { category: "Testing", activity: "Regression Testing and SIT", description: "Execute comprehensive regression testing to verify existing functionality is preserved and run system integration testing in QAS", workstream: "Quality Assurance", responsible: "Functional + Technical", accountable: "QA Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
    ],
    realizeUat: [
      { category: "UAT", activity: "User Acceptance Testing", description: "Business-led UAT in QAS focusing on converted processes, delta functionality and resolution of all identified defects", workstream: "Quality Assurance", responsible: "Functional Consultant", accountable: "Business Sponsor", consulted: "Business Users", informed: "Steering Committee", milestone: true },
      { category: "Cutover", activity: "Cutover Planning and Conversion Rehearsal", description: "Finalize production cutover plan, run full conversion rehearsal and validate go/no-go criteria including downtime window", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Board", milestone: false },
      { category: "Training", activity: "End User Training for Changed Processes", description: "Deliver role-based training covering all changed and new processes resulting from S/4HANA delta functionality", workstream: "Change Management", responsible: "Functional Consultant", accountable: "Change Manager", consulted: "Department Heads", informed: "All Users", milestone: false },
    ],
    deploy: [
      { category: "Cutover", activity: "Production System Conversion Execution", description: "Execute production system conversion using SUM within agreed downtime window and validate all technical migration steps", workstream: "Technical", responsible: "Basis + Technical Lead", accountable: "Project Manager", consulted: "All Teams", informed: "Organization", milestone: true },
      { category: "Validation", activity: "Post-Conversion Data and Process Validation", description: "Validate business data integrity, financial balances, open items and critical business processes after production conversion", workstream: "Cross-Stream", responsible: "Business SMEs", accountable: "Business Sponsor", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
      { category: "Change Management", activity: "Go-Live Communication and User Enablement", description: "Communicate go-live status to all stakeholders and confirm end-user readiness and system access in production", workstream: "Change Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "Department Heads", informed: "All Users", milestone: false },
      { category: "Go-Live", activity: "Go-Live and Hypercare Activation", description: "Activate production system post-conversion and initiate hypercare support for rapid incident resolution", workstream: "Cross-Stream", responsible: "All", accountable: "Project Manager", consulted: "Business Sponsor", informed: "Organization", milestone: false },
    ],
    run: [
      { category: "Support", activity: "System Performance and Incident Monitoring", description: "Monitor converted production system performance, background jobs and interfaces and resolve incidents with urgency", workstream: "Support", responsible: "Basis / Support", accountable: "IT Manager", consulted: "Business Users", informed: "Project Manager", milestone: false },
      { category: "Optimization", activity: "Post-Conversion System Optimization", description: "Optimize converted system performance, clean up obsolete legacy customizations and tune critical batch processes", workstream: "Technical", responsible: "Technical Lead", accountable: "IT Manager", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Knowledge Transfer", activity: "Knowledge Transfer to Internal Support Team", description: "Complete knowledge transfer for converted system and formally hand over operations to the internal BAU support team", workstream: "Change Management", responsible: "Consultants", accountable: "Internal IT Lead", consulted: "Support Team", informed: "Management", milestone: false },
      { category: "Closure", activity: "Project Closure and Lessons Learned", description: "Formal project closure, post-conversion benefits realization review and lessons learned documentation", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Board", milestone: true },
    ],
  },
  bluefield: {
    discover: [
      { category: "Assessment", activity: "Selective Migration Scope Assessment", description: "Assess which data objects, business processes and org structures to selectively migrate versus rebuild fresh in S/4HANA", workstream: "Project Management", responsible: "Solution Architect", accountable: "Business Sponsor", consulted: "Business SMEs", informed: "Board", milestone: false },
      { category: "Strategy", activity: "Bluefield Migration Strategy Definition", description: "Define selective data extraction, transformation and load strategy, and confirm tooling approach (SNP Transformation Cockpit or equivalent)", workstream: "Technical", responsible: "Data Lead", accountable: "Technical Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: true },
      { category: "Business Case", activity: "Business Case for Selective Migration", description: "Develop business case justifying selective migration approach including cost, risk and business continuity benefits over pure greenfield or brownfield", workstream: "Project Management", responsible: "SAP Consultant", accountable: "Business Sponsor", consulted: "Finance", informed: "Board", milestone: false },
    ],
    prepare: [
      { category: "Governance", activity: "Project Governance Structure and RACI", description: "Establish project governance structure, define RACI matrix, and finalize project plan with phase-wise milestones for selective migration execution", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Stream Leads", informed: "Steering Committee", milestone: true },
      { category: "Infrastructure", activity: "Shell Conversion and Landscape Setup", description: "Perform shell conversion of existing ECC system, configure new org structures and provision DEV-QAS-PRD landscape with transport routes", workstream: "Technical", responsible: "Basis / Platform", accountable: "Technical Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Infrastructure", activity: "Initial System Configuration and Access", description: "Configure initial system settings including client setup, transport management system (TMS), and user access roles for all team members", workstream: "Technical", responsible: "Basis", accountable: "Technical Lead", consulted: "IT Security", informed: "Project Manager", milestone: false },
      { category: "Tools", activity: "Selective Migration Tooling Setup", description: "Install, configure and validate selective data migration tooling (SNP Transformation Cockpit, Magnitude or equivalent) in the project landscape", workstream: "Technical", responsible: "Technical Consultant", accountable: "Technical Lead", consulted: "Tool Vendor", informed: "Project Manager", milestone: false },
      { category: "Integration", activity: "Integration Architecture Definition", description: "Define integration architecture for all upstream and downstream systems, confirming which interfaces carry over versus require redesign", workstream: "Technical", responsible: "Integration Consultant", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
    ],
    explore: [
      { category: "Fit-to-Standard", activity: "Fit-to-Standard Workshops for New Processes", description: "Conduct FTS workshops for process areas being rebuilt as net-new using SAP Best Practices and document delta requirements", workstream: "Cross-Stream", responsible: "Functional Consultant", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Design", activity: "New vs Retained Process Decision Design", description: "Finalize which processes follow the greenfield (new) approach versus carry-over from existing ECC with minimal change", workstream: "Cross-Stream", responsible: "SAP Lead Consultant", accountable: "Business Sponsor", consulted: "Process Owners", informed: "Steering Committee", milestone: true },
      { category: "Design", activity: "Functional and Technical Design Documents", description: "Finalize functional and technical design documents for both new and retained process areas including WRICEF identification", workstream: "Cross-Stream", responsible: "Functional + Technical", accountable: "Solution Architect", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Data Management", activity: "Data Object Scope and Migration Design", description: "Define data migration object scope, extraction rules, cleansing criteria and source-to-target mapping for selective load into S/4HANA", workstream: "Data Management", responsible: "Technical Consultant", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Integration", activity: "Integration Interface Design Specifications", description: "Define updated integration interface specifications and APIs for all upstream and downstream systems aligned to S/4HANA data models", workstream: "Technical", responsible: "Integration Consultant", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
    ],
    realizeDevelop: [
      { category: "Configuration", activity: "Business Process Configuration", description: "Perform detailed configuration of business processes in DEV system using IMG and transport all configuration changes to QAS", workstream: "Cross-Stream", responsible: "Functional Consultant", accountable: "Stream Leads", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Development", activity: "WRICEF Object Development", description: "Develop WRICEF objects (Reports, Interfaces, Conversions, Enhancements, Forms, Workflows) in DEV and transport to QAS", workstream: "Technical", responsible: "Technical Consultant", accountable: "Technical Lead", consulted: "Functional Consultants", informed: "Project Manager", milestone: false },
      { category: "Data Management", activity: "Selective Data Migration Mock Cycles", description: "Execute data migration mock runs using selective migration tooling, validate balances, open items and data completeness in QAS", workstream: "Data Management", responsible: "Technical Consultant", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Integration", activity: "Integration Interface Build and Validation", description: "Build and deploy integration interfaces using middleware and validate message flows across all connected systems", workstream: "Technical", responsible: "Integration Consultant", accountable: "Technical Lead", consulted: "External System Owners", informed: "Project Manager", milestone: false },
      { category: "Testing", activity: "Unit Testing and System Integration Testing", description: "Execute unit testing in DEV and end-to-end system integration testing in QAS covering both migrated and newly configured business scenarios", workstream: "Quality Assurance", responsible: "Functional + Technical", accountable: "QA Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
    ],
    realizeUat: [
      { category: "UAT", activity: "User Acceptance Testing", description: "Business-led UAT in QAS covering both selectively migrated historical data scenarios and newly configured S/4HANA process capabilities", workstream: "Quality Assurance", responsible: "Functional Consultant", accountable: "Business Sponsor", consulted: "Business Users", informed: "Steering Committee", milestone: true },
      { category: "Cutover", activity: "Cutover Planning and Migration Rehearsal", description: "Finalize cutover plan for selective migration go-live, execute full rehearsal and validate go/no-go criteria with all stakeholders", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Board", milestone: false },
      { category: "Training", activity: "End User Training for New and Migrated Processes", description: "Deliver role-based training covering both new standard processes and migrated data handling procedures for all end users", workstream: "Change Management", responsible: "Functional Consultant", accountable: "Change Manager", consulted: "Department Heads", informed: "All Users", milestone: false },
    ],
    deploy: [
      { category: "Cutover", activity: "Cutover and Transport Execution", description: "Execute cutover plan including transport of all approved objects from QAS to PRD using a controlled release strategy", workstream: "Project Management", responsible: "Project Manager + Basis", accountable: "Project Manager", consulted: "All Teams", informed: "Organization", milestone: false },
      { category: "Data Management", activity: "Final Selective Migration to Production", description: "Execute final production selective data migration, validate completeness, accuracy and data reconciliation against source systems", workstream: "Data Management", responsible: "Technical Consultant", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Change Management", activity: "End-User Training and System Access", description: "Confirm end-user access in PRD and provide final training support ahead of go-live", workstream: "Change Management", responsible: "Functional Consultant", accountable: "Change Manager", consulted: "Department Heads", informed: "All Users", milestone: false },
      { category: "Go-Live", activity: "Go-Live and Hypercare Activation", description: "Execute system go-live, cutover sign-off and activation of production environment with real-time hypercare support", workstream: "Cross-Stream", responsible: "All", accountable: "Project Manager", consulted: "Business Sponsor", informed: "Organization", milestone: true },
    ],
    run: [
      { category: "Support", activity: "System Performance and Incident Monitoring", description: "Monitor production system performance, background jobs and interfaces and resolve incidents with urgency during stabilization period", workstream: "Support", responsible: "Basis / Support", accountable: "IT Manager", consulted: "Business Users", informed: "Project Manager", milestone: false },
      { category: "Stabilization", activity: "Migrated Data Quality Validation", description: "Validate selectively migrated data quality in production, identify and remediate any migration gaps or reconciliation issues found", workstream: "Data Management", responsible: "Technical Consultant", accountable: "Data Lead", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Optimization", activity: "Continuous Improvements and Enhancements", description: "Perform continuous improvements including minor enhancements and transport changes across the system landscape", workstream: "Cross-Stream", responsible: "Functional + Technical", accountable: "IT Manager", consulted: "Business SMEs", informed: "Project Manager", milestone: false },
      { category: "Closure", activity: "Project Closure and Benefits Review", description: "Formal project closure, benefits realization review and lessons learned documentation for the selective migration approach", workstream: "Project Management", responsible: "Project Manager", accountable: "Business Sponsor", consulted: "All Teams", informed: "Board", milestone: true },
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
  // SHEET 1 - Project Plan (Gantt)
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
  const TOTAL_COL = FIXED_P + totalWeeks + 1;  // +1 for Total
  const pivotTotalCols = TOTAL_COL;

  pivot.getColumn(1).width = 4;
  pivot.getColumn(2).width = 28;
  pivot.getColumn(3).width = 15;
  pivot.getColumn(4).width = 12;
  pivot.getColumn(5).width = 15;
  for (let w = 1; w <= totalWeeks; w++) pivot.getColumn(FIXED_P + w).width = 4;
  pivot.getColumn(TOTAL_COL).width = 8;

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
  pCell(4, TOTAL_COL, "Total", { bg: "FF2D7A4F", fontColor: WHITE, bold: true, size: 9 });
  pivot.getRow(4).height = 24;

  // ── Resource rows ──
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

  const DATA_START = 5;
  const NUM_ROWS   = 20; // 15 named + 5 blank

  for (let i = 0; i < NUM_ROWS; i++) {
    const rowNum = DATA_START + i;
    const res    = RESOURCES[i] as any | undefined;
    const rowBg  = i % 2 === 0 ? WHITE : GREY_LIGHT;
    pivot.getRow(rowNum).height = 17;

    // Fixed label cells
    pCell(rowNum, 1, res ? i + 1 : "", { bg: rowBg });
    pCell(rowNum, 2, res ? res.role : "", { bg: rowBg, hAlign: "left" });
    pCell(rowNum, 3, res ? res.desc : "", { bg: rowBg });
    pCell(rowNum, 4, res ? res.loc  : "", { bg: rowBg });
    pCell(rowNum, 5, res ? res.level: "", { bg: rowBg });

    // Week input cells - coloured by phase (light)
    for (let w = 1; w <= totalWeeks; w++) {
      const phName = weekPhase[w];
      const cellBg = res ? (PHASE_LIGHT[phName] || GREY_LIGHT) : rowBg;
      const wCell  = pivot.getCell(rowNum, FIXED_P + w);
      wCell.value  = res ? 0 : "";
      wCell.font   = { size: 8, color: { argb: "FF333333" } };
      wCell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: cellBg } };
      wCell.alignment = { horizontal: "center", vertical: "middle" };
      wCell.numFmt = "0";
      wCell.border = {
        right:  { style: "hair", color: { argb: "FFBBBBBB" } },
        bottom: { style: "hair", color: { argb: "FFBBBBBB" } },
      };
    }

    // Total = SUM of week columns
    const wFirst = colToLetter(FIXED_P + 1);
    const wLast  = colToLetter(FIXED_P + totalWeeks);
    const totCell = pivot.getCell(rowNum, TOTAL_COL);
    totCell.value = res ? { formula: `SUM(${wFirst}${rowNum}:${wLast}${rowNum})` } : "";
    totCell.font  = { bold: true, size: 9, color: { argb: "FF15803D" } };
    totCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
    totCell.alignment = { horizontal: "center", vertical: "middle" };
    totCell.numFmt = "0";
    totCell.border = { right: { style: "thin", color: { argb: "FF444444" } }, bottom: { style: "hair", color: { argb: "FFCCCCCC" } } };
  }

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

  // ── Summary section (below the matrix) ──
  const SUM_GAP = totRow + 2;

  // Summary by Level header
  const levelHdrCols = 2 + plan.phases.length + 1; // Level | Desc | [phases] | Total
  pivot.mergeCells(SUM_GAP, 1, SUM_GAP, levelHdrCols);
  const slh = pivot.getCell(SUM_GAP, 1);
  slh.value = "Summary by Level";
  slh.font  = { bold: true, size: 9, color: { argb: WHITE } };
  slh.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
  slh.alignment = { horizontal: "center", vertical: "middle" };
  pivot.getRow(SUM_GAP).height = 18;

  // Column headers for summary
  const SL_HDR = SUM_GAP + 1;
  pivot.getRow(SL_HDR).height = 16;
  const summaryPhaseLabels = (plan.phases as any[]).map((p: any) => p.name);
  ["Level", "Description", ...summaryPhaseLabels, "Total"].forEach((lbl, i) => {
    const sc = pivot.getCell(SL_HDR, 1 + i);
    sc.value = lbl;
    sc.font  = { bold: true, size: 8, color: { argb: WHITE } };
    sc.fill  = { type: "pattern", pattern: "solid",
                 fgColor: { argb: i >= 2 && i < 2 + summaryPhaseLabels.length
                   ? (PHASE_SOLID[summaryPhaseLabels[i - 2]] || DARK_BG)
                   : DARK_BG } };
    sc.alignment = { horizontal: "center", vertical: "middle" };
  });

  const LEVELS = [
    { key: "Jr",            label: "Junior" },
    { key: "Sr",            label: "Senior" },
    { key: "Sol. Architect",label: "Solution Architect" },
    { key: "PM",            label: "Project Manager" },
    { key: "SDM",           label: "Service Delivery Manager" },
  ];

  const levelCol = colToLetter(5); // Level is col E in main grid

  LEVELS.forEach(({ key, label }, i) => {
    const rn = SL_HDR + 1 + i;
    const bg = i % 2 === 0 ? WHITE : GREY_LIGHT;
    pivot.getRow(rn).height = 16;

    pCell(rn, 1, key,   { bg, hAlign: "left" });
    pCell(rn, 2, label, { bg, hAlign: "left" });

    // Per-phase totals using SUMIF over week columns for each phase
    (plan.phases as any[]).forEach((ph: any, pi: number) => {
      const phStartCol = colToLetter(FIXED_P + ph.weekStart + 1);
      const phEndCol   = colToLetter(FIXED_P + ph.weekStart + ph.weeks);
      const phSumRange = `${phStartCol}${DATA_START}:${phEndCol}${DATA_START + NUM_ROWS - 1}`;
      const levelRange = `${levelCol}${DATA_START}:${levelCol}${DATA_START + NUM_ROWS - 1}`;
      const sumCell = pivot.getCell(rn, 3 + pi);
      sumCell.value = { formula: `SUMIF(${levelRange},"${key}",${phSumRange})` };
      sumCell.font  = { size: 8 };
      sumCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: PHASE_LIGHT[ph.name] || bg } };
      sumCell.alignment = { horizontal: "center", vertical: "middle" };
      sumCell.numFmt = "0";
    });

    // Row total
    const totC = pivot.getCell(rn, 3 + summaryPhaseLabels.length);
    const sumFirst = colToLetter(3);
    const sumLast  = colToLetter(2 + summaryPhaseLabels.length);
    totC.value = { formula: `SUM(${sumFirst}${rn}:${sumLast}${rn})` };
    totC.font  = { bold: true, size: 8, color: { argb: "FF15803D" } };
    totC.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    totC.alignment = { horizontal: "center", vertical: "middle" };
    totC.numFmt = "0";
  });

  // ── Summary by Description ──
  const DESC_GAP = SL_HDR + 1 + LEVELS.length + 2;
  pivot.mergeCells(DESC_GAP, 1, DESC_GAP, levelHdrCols);
  const sdh = pivot.getCell(DESC_GAP, 1);
  sdh.value = "Summary by Category";
  sdh.font  = { bold: true, size: 9, color: { argb: WHITE } };
  sdh.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BG } };
  sdh.alignment = { horizontal: "center", vertical: "middle" };
  pivot.getRow(DESC_GAP).height = 18;

  const DESC_HDR = DESC_GAP + 1;
  pivot.getRow(DESC_HDR).height = 16;
  ["Category", ...summaryPhaseLabels, "Total"].forEach((lbl, i) => {
    const sc = pivot.getCell(DESC_HDR, 1 + i);
    sc.value = lbl;
    sc.font  = { bold: true, size: 8, color: { argb: WHITE } };
    sc.fill  = { type: "pattern", pattern: "solid",
                 fgColor: { argb: i >= 1 && i < 1 + summaryPhaseLabels.length
                   ? (PHASE_SOLID[summaryPhaseLabels[i - 1]] || DARK_BG)
                   : DARK_BG } };
    sc.alignment = { horizontal: "center", vertical: "middle" };
  });

  const DESCS = ["Functional", "Technical", "Governance", "Quality", "Platform", "AI"];
  const descColLtr = colToLetter(3); // Description is col C

  DESCS.forEach((cat, i) => {
    const rn = DESC_HDR + 1 + i;
    const bg = i % 2 === 0 ? WHITE : GREY_LIGHT;
    pivot.getRow(rn).height = 16;
    pCell(rn, 1, cat, { bg, hAlign: "left" });

    (plan.phases as any[]).forEach((ph: any, pi: number) => {
      const phStartCol = colToLetter(FIXED_P + ph.weekStart + 1);
      const phEndCol   = colToLetter(FIXED_P + ph.weekStart + ph.weeks);
      const phSumRange = `${phStartCol}${DATA_START}:${phEndCol}${DATA_START + NUM_ROWS - 1}`;
      const descRange  = `${descColLtr}${DATA_START}:${descColLtr}${DATA_START + NUM_ROWS - 1}`;
      const sumCell = pivot.getCell(rn, 2 + pi);
      sumCell.value = { formula: `SUMIF(${descRange},"${cat}",${phSumRange})` };
      sumCell.font  = { size: 8 };
      sumCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: PHASE_LIGHT[ph.name] || bg } };
      sumCell.alignment = { horizontal: "center", vertical: "middle" };
      sumCell.numFmt = "0";
    });

    const totC = pivot.getCell(rn, 2 + summaryPhaseLabels.length);
    const sumFirst = colToLetter(2);
    const sumLast  = colToLetter(1 + summaryPhaseLabels.length);
    totC.value = { formula: `SUM(${sumFirst}${rn}:${sumLast}${rn})` };
    totC.font  = { bold: true, size: 8, color: { argb: "FF15803D" } };
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
